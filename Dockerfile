FROM node:8-alpine

ADD index.js /
ADD secrets.js /
ADD package.json /
ADD yarn.lock /

RUN [ "yarn" ]

CMD [ "yarn", "start" ]
