#!/bin/bash
set +e

# set defaults
ORG=${ORG:-otrro}
JAVA_OPTS=${JAVA_OPTS:--Xmx10g}
ROUTER_NAME=${1:-romania}
TEST_TAG=${2:-latest}
TOOLS_TAG=${3:-latest}
DOCKER_IMAGE=$ORG/opentripplanner-data-container-$ROUTER_NAME:test

function shutdown() {
  echo shutting down
  docker stop otp-data-$ROUTER_NAME || true
  docker stop otp-$ROUTER_NAME || true
}

echo "Making sure there are no old test containers or image available"
docker stop otp-data-romania || true
docker stop otp-romania || true
docker rmi --force $DOCKER_IMAGE || true
cd data/build/$ROUTER_NAME
echo "Building data-container image..."
docker build -t $DOCKER_IMAGE -f Dockerfile.data-container .
echo -e "\n##### Testing $ROUTER_NAME ($DOCKER_IMAGE)#####\n"

echo "Starting data container..."
docker run --rm --name otp-data-$ROUTER_NAME $DOCKER_IMAGE > /dev/stdout &
sleep 120
echo "Starting otp..."
if [ -v TEST_TAG ] && [ "$TEST_TAG" != "undefined" ]; then
  docker run --rm --name otp-$ROUTER_NAME -e ROUTER_NAME=$ROUTER_NAME -e JAVA_OPTS=$JAVA_OPTS -e ROUTER_DATA_CONTAINER_URL=http://otp-data:8080/ --link otp-data-$ROUTER_NAME:otp-data otrro/opentripplanner:$TEST_TAG > /dev/stdout &
  sleep 5
else
  docker run --rm --name otp-$ROUTER_NAME -e ROUTER_NAME=$ROUTER_NAME -e JAVA_OPTS=$JAVA_OPTS -e ROUTER_DATA_CONTAINER_URL=http://otp-data:8080/ --link otp-data-$ROUTER_NAME:otp-data otrro/opentripplanner:latest-otp1 > /dev/stdout &
  sleep 5
fi
echo "Getting otp ip.."
timeout=$(($(date +%s) + 480))
until IP=$(docker inspect --format '{{ .NetworkSettings.IPAddress }}' otp-$ROUTER_NAME) || [[ $(date +%s) -gt $timeout ]]; do sleep 1;done;

if [ "$IP" == "" ]; then
  echo "Could not get ip. failing test"
  shutdown
  exit 1
fi

echo "Got otp ip: $IP"

if [ "$ROUTER_NAME" == "timisoara" ]; then
    MAX_WAIT=30
    URL="http://$IP:8080/otp/routers/default/plan?fromPlace=45.747827%2c21.241217&toPlace=45.766714%2C21.228736"
else
    MAX_WAIT=60
    URL="http://$IP:8080/otp/routers/default/plan?fromPlace=45.747827%2c21.241217&toPlace=45.766714%2C21.228736"
fi

ITERATIONS=$(($MAX_WAIT * 6))
echo "max wait (minutes): $MAX_WAIT"

for (( c=1; c<=$ITERATIONS; c++ ));do
  STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$IP:8080/otp/routers/default || true)

  if [ $STATUS_CODE = 200 ]; then
    echo "OTP started"
    curl -s "$URL"|grep error
    if [ $? = 1 ]; then #grep finds no error
	echo "OK"
    break
    else
	echo "ERROR"
	shutdown
	exit 1;
    fi
  else
    echo "waiting for service"
    sleep 10
  fi
done

shutdown
exit 0;

echo "running otpqa"
docker run --rm --name otp-data-tools $ORG/otp-data-tools:$TOOLS_TAG /bin/sh -c "cd OTPQA; python otpprofiler_json.py http://$IP:8080/otp/routers/default $ROUTER_NAME"
if [ $? == 0 ]; then
  echo "OK"
  shutdown
  exit 0;
else
  echo "ERROR"
  shutdown
  exit 1;
fi

shutdown
exit 1;
