#!/bin/bash
# Packages the scanner as a Lambda deployment zip: worker/lambda.zip
set -e
cd "$(dirname "$0")"
rm -rf lambda-build lambda.zip && mkdir lambda-build
cp src/index.js src/analyze.js src/lambda.js lambda-build/
echo '{"type":"module"}' > lambda-build/package.json
(cd lambda-build && zip -qr ../lambda.zip .)
rm -rf lambda-build
echo "Built worker/lambda.zip  (handler: lambda.handler, runtime: nodejs20.x)"
