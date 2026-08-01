/**
 * Meeting editor — two-pane single-page editor with autosave and live preview.
 * Left: basics / agenda / appearance / advanced. Right: share panel + a
 * 1920x1080 preview iframe (OBS-accurate) that reloads after each save.
 */
(function ($) {
  'use strict';

  var ID = window.EDITOR.meetingId;
  var $form = $('#editorForm');
  var $indicator = $('#saveIndicator');

  // Checkbox fields whose "unchecked" state must be posted explicitly ('off')
  // so server-side defaults can be overridden.
  var FLAG_FIELDS = [
    'showDebug', 'showProgressBars', 'showStatusIcons', 'showTimeLabels',
    'markerShowLine', 'markerShowCircle', 'markerShowGlow', 'markerTextShowBg'
  ];

  /* ================= Presets ================= */

  var MISSION_CONTROL = {
    titleFontSize: 24, blockFontSize: 11, timeLabelFontSize: 10,
    completedColor: '404040', currentColor: 'FF6600', upcomingColor: '0099CC',
    markerPrimaryColor: 'FF0000', markerSecondaryColor: 'FFAA00',
    markerLineWidth: 3, markerCircleSize: 8, markerHeight: 100,
    markerGlowIntensity: 0.3, markerPulseSpeed: 200, markerStyle: 'modern',
    markerTextSize: 14, markerTextColor: 'FFFFFF', markerTextBg: '000000',
    markerShowLine: true, markerShowCircle: true, markerShowGlow: true, markerTextShowBg: true,
    showProgressBars: true, showStatusIcons: true, showTimeLabels: true, showDebug: false,
    segmentHeight: 50, animationSpeed: 1.0
  };

  var PRESETS = {
    'mission-control': MISSION_CONTROL,
    'minimal': $.extend({}, MISSION_CONTROL, {
      titleFontSize: 20, blockFontSize: 11, timeLabelFontSize: 9,
      completedColor: '3A3F4A', currentColor: 'FFFFFF', upcomingColor: '5A6478',
      markerPrimaryColor: 'FFFFFF', markerSecondaryColor: 'FFFFFF',
      markerLineWidth: 1, markerCircleSize: 4, markerStyle: 'minimal',
      markerShowGlow: false, markerTextShowBg: false,
      showStatusIcons: false, showTimeLabels: false,
      segmentHeight: 40
    }),
    'high-contrast': $.extend({}, MISSION_CONTROL, {
      titleFontSize: 32, blockFontSize: 14, timeLabelFontSize: 12,
      completedColor: '2E2E2E', currentColor: 'FF9500', upcomingColor: '00B3FF',
      markerPrimaryColor: 'FF2D2D', markerLineWidth: 6, markerCircleSize: 12,
      markerTextSize: 18, segmentHeight: 60
    })
  };

  function applyPreset(name) {
    var preset = PRESETS[name];
    if (!preset) return;
    Object.keys(preset).forEach(function (field) {
      var $el = $form.find('[name="' + field + '"]');
      if (!$el.length) return;
      if ($el.attr('type') === 'checkbox') {
        $el.prop('checked', preset[field] === true);
      } else {
        $el.val(String(preset[field]));
      }
    });
    $('#presetField').val(name);
    highlightPreset(name);
    syncAllPickersFromText();
    if (window.analytics) window.analytics.trackFeatureUsage('preset_applied', { preset: name });
    markDirty();
  }

  function highlightPreset(name) {
    $('.preset-card').removeClass('active');
    if (name) $('.preset-card[data-preset="' + name + '"]').addClass('active');
    $('#presetHint').text(name ? '' : 'Custom — tweaked in Advanced settings');
  }

  $('.preset-card').on('click', function () {
    applyPreset($(this).data('preset'));
  });
  $('#resetDefaults').on('click', function () {
    applyPreset('mission-control');
  });
  highlightPreset($('#presetField').val());

  // Any manual change inside Advanced makes the preset "Custom"
  $('#advancedBody').on('input change', 'input, select', function () {
    $('#presetField').val('');
    highlightPreset('');
  });

  /* ================= Color picker <-> hex text sync ================= */

  var COLOR_PAIRS = [
    ['backgroundPicker', 'background'],
    ['completedColorPicker', 'completedColor'],
    ['currentColorPicker', 'currentColor'],
    ['upcomingColorPicker', 'upcomingColor'],
    ['markerPrimaryColorPicker', 'markerPrimaryColor'],
    ['markerSecondaryColorPicker', 'markerSecondaryColor'],
    ['markerTextColorPicker', 'markerTextColor'],
    ['markerTextBgPicker', 'markerTextBg']
  ];

  COLOR_PAIRS.forEach(function (pair) {
    var picker = document.getElementById(pair[0]);
    var input = document.getElementById(pair[1]);
    if (!picker || !input) return;

    picker.addEventListener('input', function () {
      input.value = picker.value.substring(1).toUpperCase();
      input.classList.remove('is-invalid');
    });
    input.addEventListener('input', function () {
      var value = input.value.replace('#', '').toUpperCase();
      input.value = value;
      if (/^[0-9A-F]{6}$/.test(value)) {
        picker.value = '#' + value;
        input.classList.remove('is-invalid');
      } else {
        input.classList.add('is-invalid');
      }
    });
  });

  function syncAllPickersFromText() {
    COLOR_PAIRS.forEach(function (pair) {
      var picker = document.getElementById(pair[0]);
      var input = document.getElementById(pair[1]);
      if (picker && input && /^[0-9A-Fa-f]{6}$/.test(input.value)) {
        picker.value = '#' + input.value;
      }
    });
  }

  /* ================= Agenda editor ================= */

  var agendaList = document.getElementById('agendaList');

  Sortable.create(agendaList, {
    animation: 150,
    handle: '.drag-handle',
    onEnd: function () { markDirty(); }
  });

  $('#addAgendaRow').on('click', function () {
    var template = document.getElementById('agendaRowTemplate');
    agendaList.appendChild(template.content.cloneNode(true));
    var rows = agendaList.querySelectorAll('.agenda-row');
    rows[rows.length - 1].querySelector('.agenda-topic').focus();
    updateTotals();
  });

  $(agendaList).on('click', '.remove-row', function () {
    $(this).closest('.agenda-row').remove();
    markDirty();
  });

  // Validates agenda rows; returns true when every row is saveable.
  // A row that is entirely blank is ignored (the server drops it too).
  function validateAgenda() {
    var ok = true;
    $(agendaList).find('.agenda-row').each(function () {
      var $row = $(this);
      var person = $.trim($row.find('.agenda-person').val());
      var topic = $.trim($row.find('.agenda-topic').val());
      var durationRaw = $.trim($row.find('.agenda-duration').val());
      var duration = parseInt(durationRaw, 10);

      var blank = !person && !topic && !durationRaw;
      var topicBad = !blank && !topic;
      var durationBad = !blank && (!Number.isInteger(duration) || duration < 1 || duration > 480);

      $row.find('.agenda-topic').toggleClass('is-invalid', topicBad);
      $row.find('.agenda-duration').toggleClass('is-invalid', durationBad);
      if (topicBad || durationBad) ok = false;
    });
    return ok;
  }

  function updateTotals() {
    var count = 0;
    var totalMinutes = 0;
    $(agendaList).find('.agenda-row').each(function () {
      var topic = $.trim($(this).find('.agenda-topic').val());
      var duration = parseInt($(this).find('.agenda-duration').val(), 10);
      if (topic && Number.isInteger(duration) && duration > 0) {
        count++;
        totalMinutes += duration;
      }
    });

    var $totals = $('#agendaTotals');
    var startRaw = $.trim($('[name="start_time"]').val());
    var start = moment(startRaw, ['h:mm A', 'hh:mm A', 'H:mm', 'HH:mm'], true);
    var text = '<strong>' + count + '</strong> item' + (count === 1 ? '' : 's') +
      ' · <strong>' + totalMinutes + ' min</strong> total';
    if (start.isValid()) {
      var end = start.clone().add(totalMinutes, 'minutes');
      text += ' · ends <strong>' + end.format('h:mm A') + '</strong>' +
        ' <span class="text-muted">(+2 min buffer on the timeline)</span>';
      $totals.removeClass('has-error');
    } else if (startRaw) {
      text += ' · <span>start time not understood — use "9:00 AM" or "13:30"</span>';
      $totals.addClass('has-error');
    }
    $totals.html(text);
  }

  /* ================= Share panel ================= */

  function selectedView() {
    return $('input[name="default_view"]:checked').val() || window.EDITOR.defaultView || 'overlay';
  }

  function shareUrl() {
    return window.location.origin + '/meeting/' + ID + '?view=' + selectedView();
  }

  function obsUrl() {
    return window.location.origin + '/meeting/' + ID + '?view=overlay&chrome=0&transparent=1';
  }

  var qr = null;
  function updateShare() {
    $('#shareUrl').val(shareUrl());
    $('#shareWarning').toggle(!$('#is_public').prop('checked'));

    var qrEl = document.getElementById('shareQr');
    if (window.QRCode && qrEl) {
      qrEl.innerHTML = '';
      qr = new QRCode(qrEl, {
        text: shareUrl(),
        width: 118,
        height: 118,
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  function bindCopy(buttonId, getText, doneLabel) {
    var $btn = $('#' + buttonId);
    $btn.on('click', function () {
      var original = $btn.html();
      navigator.clipboard.writeText(getText()).then(function () {
        $btn.html('✓ Copied!');
        setTimeout(function () { $btn.html(original); }, 2000);
        if (window.analytics) window.analytics.trackFeatureUsage('share_link_copied', { kind: buttonId });
      }).catch(function () {
        $btn.html('Copy failed');
        setTimeout(function () { $btn.html(original); }, 2000);
      });
    });
  }
  bindCopy('copyShareUrl', shareUrl);
  bindCopy('copyObsUrl', obsUrl);

  /* ================= Live preview ================= */

  var previewWrap = document.getElementById('previewWrap');
  var previewFrame = document.getElementById('previewFrame');

  function scalePreview() {
    var scale = previewWrap.clientWidth / 1920;
    previewFrame.style.transform = 'scale(' + scale + ')';
  }
  window.addEventListener('resize', scalePreview);
  scalePreview();

  function refreshPreview() {
    previewFrame.src = '/meeting/' + ID + '?view=' + selectedView() + '&preview=1&_=' + Date.now();
  }
  $('#refreshPreview').on('click', refreshPreview);
  refreshPreview();

  /* ================= Autosave ================= */

  var dirty = false;
  var saving = false;
  var queued = false;
  var saveTimer = null;

  function setIndicator(cls, text) {
    $indicator.attr('class', 'save-indicator mr-3 ' + cls).text(text);
  }

  function markDirty() {
    dirty = true;
    setIndicator('is-dirty', '● Unsaved changes');
    updateTotals();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 800);
  }

  function validateAll() {
    var ok = validateAgenda();
    var $title = $('#title');
    var titleBad = !$.trim($title.val());
    $title.toggleClass('is-invalid', titleBad);

    var $start = $('[name="start_time"]');
    var startBad = !moment($.trim($start.val()), ['h:mm A', 'hh:mm A', 'H:mm', 'HH:mm'], true).isValid();
    $start.toggleClass('is-invalid', startBad);

    return ok && !titleBad && !startBad;
  }

  function serializeWithFlags() {
    var data = $form.serialize();
    FLAG_FIELDS.forEach(function (field) {
      var $el = $form.find('[name="' + field + '"]');
      if ($el.length && !$el.prop('checked')) {
        data += '&' + field + '=off';
      }
    });
    return data;
  }

  function save() {
    if (saving) { queued = true; return; }
    if (!validateAll()) {
      setIndicator('is-error', '● Fix errors to save');
      return;
    }

    saving = true;
    setIndicator('is-saving', '● Saving…');

    $.ajax({
      method: 'POST',
      url: '/meeting/' + ID,
      data: serializeWithFlags()
    }).done(function () {
      saving = false;
      dirty = false;
      setIndicator('is-saved', '● Saved');
      window.EDITOR.isPublic = $('#is_public').prop('checked');
      updateShare();
      refreshPreview();
      $('#openTimeline').attr('href', '/meeting/' + ID + '?view=' + selectedView() + '&chrome=1');
      if (queued) { queued = false; save(); }
    }).fail(function (xhr) {
      saving = false;
      var message = '● Not saved';
      var body = xhr.responseJSON;
      if (body && body.errors) {
        var first = Object.keys(body.errors)[0];
        message = '● ' + body.errors[first];
      } else if (xhr.status === 0) {
        message = '● Offline — will retry on next change';
      }
      setIndicator('is-error', message);
      if (queued) { queued = false; }
    });
  }

  $form.on('input change', function () {
    markDirty();
  });

  $form.on('submit', function (e) {
    e.preventDefault();
    clearTimeout(saveTimer);
    save();
  });

  $('#saveNow').on('click', function () {
    clearTimeout(saveTimer);
    save();
  });

  window.addEventListener('beforeunload', function (e) {
    if (dirty || saving) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Live header title
  $('#title').on('input', function () {
    $('.editor-header h4').text('✏️ ' + ($(this).val() || 'Untitled meeting'));
  });

  /* ================= Analytics ================= */

  if (window.analytics) {
    var editFormStarted = false;
    $form.find('input, select').one('focus', function () {
      if (!editFormStarted) {
        editFormStarted = true;
        window.analytics.trackFormStart('edit_meeting');
        window.analytics.trackMeetingEdited(ID);
      }
    });
  }

  /* ================= Init ================= */

  updateShare();
  updateTotals();
  setIndicator('is-saved', '● Saved');
})(jQuery);
