FROM node:15.5-alpine

COPY . .

EXPOSE 3000

CMD ["node", "start.js"]
