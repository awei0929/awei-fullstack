// 统计响应的 TypeScript 类型。这里描述输出结构，实际返回的数据由 Service 构造。
// 这是计算得到的响应，不对应额外的 MongoDB 集合，也不代替输入 DTO 的运行时校验。
export interface TaskStats {
  total: number; // 个人端点返回本人数量；公共端点返回固定示例数量。
  uptimeSeconds: number; // 秒数由后端计算；页面是否展示它不影响 HTTP 合同。
}
