#!/bin/bash
set -e
# This is run at ci, created an image that contains all the tools needed in
# databuild

ORG=${ORG:-opentransport}
DOCKER_IMAGE=otp-data-builder

DOCKER_TAG="ci-${CI_COMMIT_SHORT_SHA:-latest}"
# Set these environment variables
#DOCKER_USER=
#DOCKER_AUTH=

function tagandpush {
  docker tag $ORG/$1:$3$DOCKER_TAG $ORG/$1:$2
  docker push $ORG/$1:$2
}

function imagedeploy {
  if [ -z ${CI_MERGE_REQUEST_ID} ]; then
    docker login -u $DOCKER_USER -p $DOCKER_AUTH
    if [ "$CI_COMMIT_TAG" ];then
      echo "processing release $CI_COMMIT_TAG"
      #release do not rebuild, just tag
      docker pull $ORG/$1:$DOCKER_TAG
      tagandpush $1 "prod" ""
    else
      if [ "$CI_COMMIT_REF_NAME" = "master" ]; then
        echo "processing master build $CI_COMMIT_SHORT_SHA"
        #master branch, build and tag as latest
        docker build --tag="$ORG/$1:$DOCKER_TAG" .
        docker push $ORG/$1:$DOCKER_TAG
        tagandpush $1 "latest" ""
      elif [ "$CI_COMMIT_REF_NAME" = "next" ]; then
        echo "processing master build $CI_COMMIT_SHORT_SHA"
        #master branch, build and tag as latest
        docker build --tag="$ORG/$1:next-$DOCKER_TAG" .
        docker push $ORG/$1:next-$DOCKER_TAG
        tagandpush $1 "next" "next-"
      else
        #check if branch is greenkeeper branch
        echo Not Pushing greenkeeper to docker hub
        exit 0
      fi
    fi
  else
    echo "processing pr $CI_MERGE_REQUEST_ID"
    docker build --tag="$ORG/$1:$DOCKER_TAG" .
  fi
}

imagedeploy "otp-data-builder"

cd otp-data-tools

imagedeploy "otp-data-tools"

echo Build completed
