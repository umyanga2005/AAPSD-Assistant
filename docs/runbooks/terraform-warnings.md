---
id: 'runbook-terraform-warnings'
title: 'Terraform Plan Warnings'
tags: ['terraform', 'plan', 'warnings', 'drift']
---

## Diagnosis

Terraform plan warnings often indicate deprecated module usage, unexpected resource drift, or provider version mismatches.

## Steps

1. Review the plan output to identify the specific warning messages.
2. Check for deprecated arguments and update them to their modern equivalents.
3. If drift is detected, determine if it was intentional out-of-band changes or accidental.
4. Verify provider versions and lock files.
5. Do NOT apply the plan until the warnings are fully understood.
