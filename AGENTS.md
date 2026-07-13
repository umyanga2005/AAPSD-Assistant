# Workflow

For every task:

1. Read the relevant plan file from `Plans/`
2. Inspect the repository before changing anything
3. Do one small task only
4. Run tests/lint/type-check after implementation
5. Review the changed files yourself
6. Commit the completed task before moving on using this git workflow:
```
git status
git add .
git commit -m "feat: add application foundation"
```

# Guardrails

- Do not expose secrets.
- Do not create unrestricted shell execution.
- Do not give AI direct cloud, GitHub, Docker, or Kubernetes credentials.
- Use typed inputs and a policy-controlled executor.
- Implement staging-only actions first.
- Do not change unrelated files.
- Run tests after each change.
