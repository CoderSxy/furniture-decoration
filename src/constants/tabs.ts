export const TAB_ITEMS = [
  {
    pagePath: 'pages/catalog/index',
    text: '选品',
    duty: '浏览家具、筛选并进入详情。',
  },
  {
    pagePath: 'pages/plans/index',
    text: '方案',
    duty: '管理装修方案与阶段进度。',
  },
  {
    pagePath: 'pages/budget/index',
    text: '预算',
    duty: '查看当前方案的总额、类目占用与阶段进度。',
  },
  {
    pagePath: 'pages/mine/index',
    text: '我的',
    duty: '收藏、登录态、云端同步与清除我的数据。',
  },
] as const

export type TabItem = (typeof TAB_ITEMS)[number]
