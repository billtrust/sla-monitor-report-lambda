FROM node:8.10-stretch

WORKDIR /app

COPY . .

RUN npm install -g serverless && \
    npm install

ENTRYPOINT ["/bin/bash"]
