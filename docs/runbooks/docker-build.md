---
id: 'runbook-docker-build'
title: 'Docker Image Build Failure'
tags: ['docker', 'build', 'failure', 'image']
---

## Diagnosis

Image builds can fail for a variety of reasons, usually related to network connectivity, missing dependencies, or syntax errors in the Dockerfile.

## Steps

1. Review the build logs for specific failure points.
2. Verify base image availability and registry authentication.
3. Check network access for any `apt-get` or `npm install` steps.
4. Ensure sufficient disk space on the build runner.
5. Validate the Dockerfile syntax.
