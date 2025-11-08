module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    project: "./tsconfig.json"
  },
  plugins: ["@typescript-eslint", "import", "vitest"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/typescript",
    "prettier"
  ],
  env: {
    es6: true,
    node: true
  },
  rules: {
    // ========== 性能优化规则 ==========
    // 避免不必要的循环和迭代
    "@typescript-eslint/prefer-for-of": "off",
    "@typescript-eslint/prefer-includes": "off",
    "no-loop-func": "error",

    // 避免深度嵌套
    "max-depth": ["warn", 5],
    "max-nested-callbacks": ["warn", 4],

    // 避免不必要的计算
    "no-constant-condition": "error",
    "no-unmodified-loop-condition": "error",

    // 避免创建过多临时对象
    "no-array-constructor": "error",
    "no-new-object": "error",

    // 避免不必要的类型转换
    "@typescript-eslint/no-unnecessary-type-assertion": "warn",
    "@typescript-eslint/no-explicit-any": "off",

    // 避免不必要的条件判断
    "no-constant-binary-expression": "error",
    "no-unneeded-ternary": "warn",

    // 避免同步阻塞操作（Screeps 环境限制）
    "no-sync": "error",

    // ========== 避免阻塞和错误规则 ==========
    // 允许使用 console（Screeps 调试需要）
    "no-console": "off",

    // 避免未捕获的错误
    "no-throw-literal": "error",
    "@typescript-eslint/no-throw-literal": "error",

    // 避免未使用的变量（但允许未使用的参数，因为可能是接口要求）
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }
    ],

    // 避免可能导致运行时错误的代码
    "no-undef": "error",
    "@typescript-eslint/no-floating-promises": "off",
    "@typescript-eslint/no-misused-promises": "off",

    // 避免空函数（可能遗漏实现）
    "no-empty-function": "warn",
    "@typescript-eslint/no-empty-function": "warn",

    // 避免可能导致内存泄漏的模式
    "no-return-assign": "error",

    // ========== 代码质量规则 ==========
    // 类型安全
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-inferrable-types": "warn",

    // 允许使用 require（Screeps 环境需要）
    "@typescript-eslint/no-var-requires": "off",

    // 允许使用 @ts-ignore（某些情况下需要）
    "@typescript-eslint/ban-ts-comment": [
      "warn",
      {
        "ts-expect-error": "allow-with-description",
        "ts-ignore": "allow-with-description",
        "ts-nocheck": "allow-with-description",
        "ts-check": false
      }
    ],

    // 导入顺序
    "import/order": [
      "warn",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index"
        ],
        "newlines-between": "never",
        alphabetize: {
          order: "asc",
          caseInsensitive: true
        }
      }
    ],

    // 避免循环依赖
    "import/no-cycle": "error",

    // 确保导入的文件存在
    "import/no-unresolved": "off"
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.spec.ts"],
      env: {
        "vitest/globals": true
      },
      plugins: ["vitest"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-non-null-assertion": "off"
      }
    }
  ]
};

