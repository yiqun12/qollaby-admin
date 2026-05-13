# App 端广告 Tag 区分方案

## 背景

Admin 后台已将 `sponsor_ads` 拆成三类，通过 `tag` 字段区分：

| tag 值 | Admin 页面 | 对应 App 页面 |
|--------|-----------|-------------|
| `home` | Home Ads | Home / Feed 首页 |
| `event` | Event Ads | Events 活动页 |
| `exchange` | Exchange Ads | Exchange 交换页 |

## 数据库变更

Appwrite `sponsor_ads` 集合已新增属性：

- **字段名**: `tag`
- **类型**: String
- **大小**: 64
- **必填**: 否
- **可选值**: `"home"` | `"event"` | `"exchange"`

旧数据如果没有 `tag`，默认视为 `"home"`。

## App 端需要做的事

### 1. 查询时加 tag 过滤

目前 App 端拉取广告的逻辑大概是：

```typescript
// 旧写法 - 不区分
const ads = await databases.listDocuments(DATABASE_ID, "sponsor_ads", [
  Query.equal("isAdminCreated", true),
  Query.equal("status", "active"),
  // ...
]);
```

改为按 tag 过滤：

```typescript
// 新写法 - 按页面类型传 tag
function getAdsByTag(tag: "home" | "event" | "exchange") {
  return databases.listDocuments(DATABASE_ID, "sponsor_ads", [
    Query.equal("isAdminCreated", true),
    Query.equal("status", "active"),
    Query.equal("tag", tag),
    // ...其他已有 filter
  ]);
}
```

### 2. 各页面调用

```typescript
// Home / Feed 页
const homeAds = await getAdsByTag("home");

// Events 页
const eventAds = await getAdsByTag("event");

// Exchange 页
const exchangeAds = await getAdsByTag("exchange");
```

### 3. 兼容旧数据

如果有历史广告没有 `tag` 字段，可以在查询时做兼容：

```typescript
// 方案 A：只展示有 tag 的（推荐，干净）
Query.equal("tag", tag)

// 方案 B：home 页兼容无 tag 的旧数据
if (tag === "home") {
  Query.or([
    Query.equal("tag", "home"),
    Query.isNull("tag"),
    Query.equal("tag", ""),
  ])
}
```

### 4. 类型定义

在 App 端的类型文件中加上 tag：

```typescript
type AdTagType = "home" | "event" | "exchange";

interface SponsorAd {
  // ...已有字段
  tag?: AdTagType;
}
```

## 文件改动清单（App 端参考）

| 需要改的地方 | 改什么 |
|------------|-------|
| 广告类型定义 | 加 `tag?: AdTagType` |
| 广告查询函数 | 加 `tag` 参数 + `Query.equal("tag", tag)` |
| Home/Feed 页 | 调用时传 `tag: "home"` |
| Events 页 | 调用时传 `tag: "event"` |
| Exchange 页 | 调用时传 `tag: "exchange"` |
| 用户发布广告（如有） | 提交时带上 `tag` 字段 |

## 当前 sample 数据

已通过 seed 脚本创建了 9 条测试广告：

- **home**: Slot 1, 5, 8（CodeCraft / Canva / GrowthEngine）
- **event**: Slot 1, 5, 10（SkillForge / FitLife / Frame.io）
- **exchange**: Slot 1, 5, 8（BuildRight / TalentBridge / Apartments.com）
