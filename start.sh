#!/bin/sh
if [ "" == ""$BRIGADE_PROJECT_ID ]; then
  node src/index.js
  exit
fi

cp /app/brigade.js $BRIGADE_WORKSPACE/brigade.js
