#!/bin/bash

if [[ -z "$AWS_ENV" ]]; then
    echo "Missing AWS_ENV"
    exit 1
fi

TEST_JSON_FILE=$(node ./events/generateTestingEvent.js)
echo "TEST_JSON_FILE: $TEST_JSON_FILE"

sls invoke local \
    -f sla-monitor-report-sqsworker \
    -p $TEST_JSON_FILE \
    -l -e AWS_ENV=$AWS_ENV -e AWS_REGION=us-east-1 \
    --deployBucket notneededfortestinvoke
