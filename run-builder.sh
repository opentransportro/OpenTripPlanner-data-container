#!/bin/bash

#build errors should not stop the continuous build loop
set +e

export DOCKER_API_VERSION="1.23"

#How long the build can last before it is considered frozen (default 5 hours)
MAX_TIME=${MAX_TIME:-18000}
#how often data is built (default once a day)
BUILD_INTERVAL=${BUILD_INTERVAL:-1}
#Substract one day, because first wait hours are computed before each build
BUILD_INTERVAL_SECONDS=$((($BUILD_INTERVAL - 1)*24*3600))
#start build at this time (GMT):
BUILD_TIME=${BUILD_TIME:-23:00:00}
#option to launch build automatically at early hours
#as a mitigation to crashed builds. zero value disables this feature
AUTO_REBUILD_HOUR=${AUTO_REBUILD_HOUR:-3}
BUILDER_TYPE=${BUILDER_TYPE:-dev}

# param: message text content
function post_slack_message {
    MSG='{"username":"OTP data builder '$BUILDER_TYPE'","text":"'$1'"}'

    if [ -v SLACK_WEBHOOK_URL ]; then
        curl -X POST -H 'Content-type: application/json' --data $MSG $SLACK_WEBHOOK_URL
    fi
}

# build should be started immediately if service starts before 06:00
# because that is considered as a restart after a service failure
HOUR=$(date +%-H)
if [[ "$HOUR" -lt "$AUTO_REBUILD_HOUR" ]]; then
    BUILD_AT_LAUNCH=1
else
    BUILD_AT_LAUNCH=0
fi

# run data build loop forever, unless build interval is set to zero
while true; do
    if [[ "$BUILD_INTERVAL" -gt 0 ]] && [[ "$BUILD_AT_LAUNCH" -eq 0 ]]; then
        SLEEP=$(($(date -u -d $BUILD_TIME +%s) - $(date -u +%s) + 1))
        if [[ "$SLEEP" -le 0 ]]; then
            #today's build time is gone, start counting from tomorrow
            SLEEP=$(($SLEEP + 24*3600))
        fi
        SLEEP=$(($SLEEP + $BUILD_INTERVAL_SECONDS))

        echo "** Sleeping $SLEEP seconds until the next build"
        sleep $SLEEP
    fi

    BUILD_AT_LAUNCH=0 #reset

    echo "** Launching OTP data builder"

    #note: busybox timeout
    timeout -t $MAX_TIME node index.js once
    SUCCESS=$?

    if [ $SUCCESS = 143 ]; then
        text='** ERROR: Build frozen, restarting'
        echo "$text"
        post_slack_message "$text"
    else
        if [ $SUCCESS -ne 0 ]; then
            echo "** ERROR: Build failed"
        fi
    fi

    if [ $SUCCESS -ne 0 ]; then
        # try once more
        echo "** Restarting builder once"
        timeout -t $MAX_TIME  node index.js once
        SUCCESS=$?

        if [ $SUCCESS = 143 ]; then
            text='** ERROR: Second build frozen. Trying again tomorrow.'
            echo "$text"
            post_slack_message "$text"
        else
            if [ $SUCCESS -ne 0 ]; then
                echo "** ERROR: Second build failed"
            fi
        fi
    fi

    echo "** OTP data build cycle done"

    if [[ "$BUILD_INTERVAL" -le 0 ]]; then
        #run only once
        exit 0
    fi
done
