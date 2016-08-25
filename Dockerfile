FROM mhart/alpine-node
MAINTAINER Shinichi SUGIYAMA <shin.sugi@gmail.com>

RUN apk add --no-cache git
RUN mkdir -p /var/www
COPY . /var/www
WORKDIR /var/www
RUN npm install
EXPOSE 3000
CMD [ "npm", "start" ]