export default defineAppConfig({
  pages: [
    'pages/catalog/index',
    'pages/plans/index',
    'pages/budget/index',
    'pages/mine/index',
  ],
  subPackages: [
    {
      root: 'packageScan',
      pages: ['pages/scan/index'],
    },
    {
      root: 'packagePreview',
      pages: ['pages/ai/recommend', 'pages/preview/index'],
    },
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#F7F3EE',
    navigationBarTitleText: '家具装修',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F7F3EE',
  },
  tabBar: {
    color: '#7A7168',
    selectedColor: '#C45C26',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/catalog/index',
        text: '选品',
        iconPath: 'assets/tab/catalog.png',
        selectedIconPath: 'assets/tab/catalog-active.png',
      },
      {
        pagePath: 'pages/plans/index',
        text: '方案',
        iconPath: 'assets/tab/plans.png',
        selectedIconPath: 'assets/tab/plans-active.png',
      },
      {
        pagePath: 'pages/budget/index',
        text: '预算',
        iconPath: 'assets/tab/budget.png',
        selectedIconPath: 'assets/tab/budget-active.png',
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/tab/mine.png',
        selectedIconPath: 'assets/tab/mine-active.png',
      },
    ],
  },
})
