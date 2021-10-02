// Example starter JavaScript for disabling form submissions if there are invalid fields
(function () {
  'use strict'

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  var forms = document.querySelectorAll('.needs-validation')

  // Loop over them and prevent submission
  Array.prototype.slice.call(forms)
    .forEach(function (form) {
      form.addEventListener('submit', function (event) {
        if (!form.checkValidity()) {
          event.preventDefault()
          event.stopPropagation()
        }

        form.classList.add('was-validated')
      }, false)
    })
})()

$(".timepicker").datetimepicker({
  format: "LT",
  icons: {
    up: "fa fa-chevron-up",
    down: "fa fa-chevron-down"
  }
});

$('#background').colorpicker({

});
$('#background').on('colorpickerChange', function(event) {
  $('#color_display').css('background-color', event.color.toString());
});


$(".add-more").click(function(e){
    var list = $("demo1");
    var name = $("#person1").val();
    var topic = $("#topic1").val();
    var duration = $("#duration1").val();

    var meetingItemTemplate = $("#meetingItemTemplate").html();

    $(demo1).append(
      meetingItemTemplate.replace("{person}",name)
      .replace("{topic}", topic)
      .replace("{duration}", duration)
    );

    // Need to add a listener to remove the items too
    $('.remove-me').click(function(e){
        e.preventDefault();
        // First parent is the div, second is the li that we want to remove
        $(this).parent().parent().remove();
    });
});

$('.remove-me').click(function(e){
    e.preventDefault();
    // First parent is the div, second is the li that we want to remove
    $(this).parent().parent().remove();
});


Sortable.create(demo1, {
  animation: 100,
  group: 'list-1',
  draggable: '.list-group-item',
  handle: '.list-group-item',
  sort: true,
  filter: '.sortable-disabled',
  chosenClass: 'active'
});
