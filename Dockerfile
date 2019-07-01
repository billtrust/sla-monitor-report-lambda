FROM node:8.16-jessie

WORKDIR /app

COPY . .

RUN npm install -g serverless && \
    npm install --save-dev serverless-mocha-plugin && \
    npm install --save-dev serverless-prune-plugin && \
    cd src && \
    npm install

ENTRYPOINT ["/bin/bash"]
