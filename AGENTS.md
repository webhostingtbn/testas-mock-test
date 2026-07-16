<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# TypeScript Strictness Rule

**All new code must use strict TypeScript types. Do not use `any` unless absolutely unavoidable.**

When writing or modifying code:

1. **Define explicit interfaces** for all data structures, props, and function parameters
2. **Never use `any`** - use `unknown`, generic types, or proper interfaces instead
3. **Enable strict null checks** - handle undefined/null cases explicitly
4. **Use type guards** for union types before accessing properties
5. **Prefer const assertions** (`as const`) for literal values
6. **Use strict equality** (`===`/`!==`) for all comparisons
7. **Avoid type assertions** (`as Type`) unless you've verified the type at runtime

Example of GOOD code:

```typescript
interface User {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  profile?: {
    name: string;
    avatar?: string;
  };
}

function getUserRole(user: User): 'admin' | 'user' | 'guest' {
  return user.role;
}
```

Example of BAD code (avoid):

```typescript
// Using 'any' - NO!
function processUser(user: any): any {
  return user.role; // No type safety
}

// Not handling undefined - NO!
function getUserName(user: { name?: string }) {
  return user.name.toUpperCase(); // Crash if name is undefined
}
```
<!-- END:nextjs-agent-rules -->
