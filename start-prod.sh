#!/bin/bash
export COZE_PROJECT_ENV=PROD
cd /var/www/yanxue-cost
PORT=5000 node dist/server.js
