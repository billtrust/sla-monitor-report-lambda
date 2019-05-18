#!/bin/bash

if [[ -z "$AWS_ENV" ]]; then
    echo "Missing AWS_ENV"
    exit 1
fi

if [[ -z "$DEPLOY_BUCKET" ]]; then
    echo "Missing DEPLOY_BUCKET"
    exit 1
fi

sls invoke local \
    -f sla-monitor-report-sqsworker \
    -p ./events/result-published-event.json \
    -l -e AWS_ENV=$AWS_ENV -e AWS_REGION=us-east-1 \
    --deployBucket $DEPLOY_BUCKET
