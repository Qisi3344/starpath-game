/** 娱乐圈地图 Alpha 数据：入口与资源定位草案；不生成实际游戏收益/任务。 */
export const INDUSTRY_DISTRICTS = [
  {id:'north', title:'北城区', group:'巨头与行业组织', desc:'大型经纪公司总部、年度颁奖活动和行业发布会汇集于此。', opportunities:'行业会议 · 竞争公司动态', progress:'locked'},
  {id:'east', title:'东城区', group:'平台与媒体', desc:'电视台、视频平台、新闻媒体与品牌宣发团队的主要工作区域。', opportunities:'综艺通告 · 媒体合作', progress:'preview'},
  {id:'west', title:'西城区', group:'影视与音乐', desc:'影视基地、录音棚、选角中心与制作工作室聚集的区域。', opportunities:'角色试镜 · 音乐制作', progress:'preview'},
  {id:'south', title:'南城区', group:'商业与品牌', desc:'广告拍摄、品牌代言、商务活动与时尚资源的集中区域。', opportunities:'品牌商务 · 时尚合作', progress:'preview'},
  {id:'newtown', title:'新城区', group:'新锐与发掘', desc:'演艺培训中心、独立厂牌和新兴小型经纪工作室的聚集地。', opportunities:'新人寻访 · 星探派遣', progress:'preview'},
] as const;
export type DistrictId = typeof INDUSTRY_DISTRICTS[number]['id'];
