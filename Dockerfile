FROM       node:10-alpine
MAINTAINER OpenTransport version: 0.1

RUN apk add --update --no-cache \
  bash \
  curl \
  && rm -rf /var/cache/apk/*

WORKDIR /opt/otp-data-builder

ADD https://download.docker.com/linux/static/stable/x86_64/docker-18.06.1-ce.tgz ${WORKDIR}/
RUN cd ${WORKDIR} ; tar xzf docker-18.06.1-ce.tgz ; cp docker/docker /usr/bin/docker ; rm -rf docker*

ADD package-lock.json package.json *.js *.sh  gulpfile.js /opt/otp-data-builder/

ADD task ${WORKDIR}/task
ADD router-romania ${WORKDIR}/otp-data-builderer/router-romania
ADD otp-data-container ${WORKDIR}/otp-data-container

RUN npm install

CMD bash ./run-builder.sh
