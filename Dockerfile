FROM node
MAINTAINER Shinichi SUGIYAMA <shin.sugi@gmail.com>

COPY web /tmp
WORKDIR /tmp
RUN npm install
RUN npm run build
RUN mkdir -p /var/www
WORKDIR /var/www
RUN mv /tmp/public /var/www
COPY package.json app.js /var/www/
COPY lib /var/www/lib
RUN npm install
EXPOSE 3000
CMD [ "npm", "start" ]