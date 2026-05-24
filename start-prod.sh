#!/bin/bash
export COZE_PROJECT_ENV=PROD
cd /var/www/yanxue-cost
PORT=5050 node dist/server.js
