---
id: github-deployment-failure
title: GitHub Actions Deployment Failure
tags: [github, actions, deployment, ci/cd, pipeline, build, job, workflow]
---

## Overview

This runbook covers common GitHub Actions deployment failures, including job failures, image build/push errors, and workflow configuration issues.

## Common Causes

1. **Missing or incorrect image tag**: The build job produces an image with a tag that does not match what the deploy job expects. Verify that the image tag in the deploy step matches the build output.

2. **Registry authentication failure**: The GitHub Actions runner may not have valid credentials to push or pull from the container registry. Check that `DOCKER_USERNAME` and `DOCKER_PASSWORD` (or equivalent) secrets are set correctly in the repository or organization settings.

3. **Workflow syntax error**: A YAML syntax error in the workflow file can cause the entire run to fail. Validate the workflow file using `action-validator` or the GitHub Actions linting tool.

4. **Runner availability**: Self-hosted runners may be offline or busy. Check the runner status under repository Settings > Actions > Runners.

5. **Environment variable mismatch**: Required environment variables or secrets may be missing from the deployment environment. Compare the environment configuration between the workflow file and the GitHub environment settings.

## Diagnostic Steps

1. Open the failing workflow run in the GitHub Actions tab.
2. Identify the exact job and step that failed.
3. Expand the failed step logs to read the error message.
4. Check the workflow file for any recent changes that may have introduced the issue.
5. Verify that all required secrets and environment variables exist and are spelled correctly.

## Resolution

- If the image tag is incorrect, update the workflow to use a consistent tagging strategy (e.g., `git sha` or semantic version).
- If registry auth fails, verify secrets under repository Settings > Secrets and Variables > Actions.
- If the runner is offline, restart the runner or switch to a GitHub-hosted runner.
- If the syntax is invalid, run a local YAML linter and fix errors before pushing.

## Related

- Kubernetes ImagePullBackOff runbook
- High CPU / memory troubleshooting runbook
