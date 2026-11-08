import { plainToInstance, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsDefined, IsIn, IsInt, IsObject, Matches, Max, Min, ValidateBy, ValidateNested, isEmail } from 'class-validator';
import type { ValidationOptions } from 'class-validator';
import { defaultSiteCapabilities, defaultSiteMusic } from '../config/site.defaults.js';
import { SITE_CAPABILITY_ICONS } from '../config/site.capabilities.js';

// 组合装饰器仍登记真实运行时规则；字符串按Unicode码点限长，必填文本拒绝纯空白。
function Text(max: number, min = 0, options?: ValidationOptions): PropertyDecorator {
  return ValidateBy({ name: 'siteText', constraints: [max, min], validator: {
    validate: (value: unknown) => typeof value === 'string' && Array.from(value).length <= max && Array.from(value).length >= min && (min === 0 || value.trim().length > 0),
    defaultMessage: () => `文本长度须为${min}–${max}个字符`,
  } }, options);
}

// URL只接受明确的http(s)，局部资源只放行约定路径；禁止控制字符、反斜杠与路径穿越。
// 不依赖浏览器自动纠正URL，否则同一个字符串在服务端和浏览器可能指向不同位置。
function SiteUrl(kind: 'external' | 'audio' | 'image'): PropertyDecorator {
  return ValidateBy({ name: 'siteUrl', validator: {
    validate(value: unknown): boolean {
      if (typeof value !== 'string' || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return false;
      if (value === '') return true;
      if (kind === 'audio' && /^\/api\/site\/assets\/[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(mp3|wav|ogg)$/.test(value)) return true;
      if (kind === 'image' && /^\/api\/site\/assets\/[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(png|jpg|webp)$/.test(value)) return true;
      if (!/^https?:\/\//i.test(value)) return false;
      try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password; }
      catch { return false; }
    },
    defaultMessage: () => '链接必须为空或合法的HTTP/HTTPS地址（仅允许约定的本站路径）',
  } });
}

// 每个嵌套对象都声明独立DTO类，Type提供运行时构造器，ValidateNested使未知字段同样被拒绝。
class ProfileDto {
  @Text(60, 1) name!: string;
  @Text(160) tagline!: string;
  @Text(4000) bio!: string;
}
class HomeDto {
  @Text(80, 1) eyebrow!: string;
  @Text(80, 1) title!: string;
  @Text(240) subtitle!: string;
  @Text(30, 1) buttonLabel!: string;
}
class LinkDto {
  @Text(50, 1) label!: string;
  @SiteUrl('external') url!: string;
}
class ContactDto {
  // 产品仅支持前端可解析的常见邮箱子集；标准邮箱校验仍保留，空值表示不公开邮箱。
  @ValidateBy({ name: 'siteEmail', validator: {
    validate: (value: unknown) => typeof value === 'string' && (value === '' || (value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && isEmail(value))),
    defaultMessage: () => '邮箱必须为空或不含空白、使用单个@且域名含点的有效邮箱',
  } }) email!: string;
  // ValidateNested会递归数组；每项还须显式是对象，避免[[]]跳过字段规则。
  @IsArray() @ArrayMaxSize(8) @IsObject({ each: true }) @ValidateNested({ each: true }) @Type(() => LinkDto) links!: LinkDto[];
}
class AppearanceDto {
  @IsBoolean() motion!: boolean;
  @IsIn(['classic']) character!: 'classic';
}
class MusicDto {
  @IsBoolean() enabled!: boolean;
  @Text(80) title!: string;
  @SiteUrl('audio')
  @ValidateBy({ name: 'enabledMusicSource', validator: {
    validate: (value: unknown, args) => !(args?.object as MusicDto).enabled || (typeof value === 'string' && value.length > 0),
    defaultMessage: () => '启用背景音乐前请先配置音源',
  } }) sourceUrl!: string;
  @IsInt() @Min(0) @Max(100) volume!: number;
  @IsBoolean() loop!: boolean;
}
class CapabilityItemDto {
  @IsIn(SITE_CAPABILITY_ICONS) icon!: string;
  @Text(40, 1) name!: string;
}
// 每组独立限制数量与图标唯一性；逐项IsObject防止嵌套数组绕过ValidateNested。
// 分组自身没有默认值，因此显式传入半个对象时不会把遗漏分组静默补齐。
class CapabilitiesDto {
  @IsArray() @ArrayMaxSize(12) @IsObject({ each: true }) @ArrayUnique((item: CapabilityItemDto) => item?.icon) @ValidateNested({ each: true }) @Type(() => CapabilityItemDto) ai!: CapabilityItemDto[];
  @IsArray() @ArrayMaxSize(12) @IsObject({ each: true }) @ArrayUnique((item: CapabilityItemDto) => item?.icon) @ValidateNested({ each: true }) @Type(() => CapabilityItemDto) frontend!: CapabilityItemDto[];
  @IsArray() @ArrayMaxSize(12) @IsObject({ each: true }) @ArrayUnique((item: CapabilityItemDto) => item?.icon) @ValidateNested({ each: true }) @Type(() => CapabilityItemDto) backend!: CapabilityItemDto[];
  @IsArray() @ArrayMaxSize(12) @IsObject({ each: true }) @ArrayUnique((item: CapabilityItemDto) => item?.icon) @ValidateNested({ each: true }) @Type(() => CapabilityItemDto) deployment!: CapabilityItemDto[];
}
class TechnologyDetailsDto {
  @Text(2000) introduction!: string;
}
class CompanyDetailsDto {
  @Text(80) name!: string;
  @Text(300) summary!: string;
  // Markdown按原文存储，不在HTTP边界转换成HTML；只校验字符串和Unicode长度。
  @Text(10000) introduction!: string;
  @Text(10000) business!: string;
  @Text(10000) responsibilities!: string;
}
class CapabilityProjectDto {
  @Text(64, 1) @Matches(/^[A-Za-z0-9_-]+$/) id!: string;
  @Text(80, 1) name!: string;
  @Text(300) summary!: string;
  @Text(20000) content!: string;
  @SiteUrl('image') coverUrl!: string;
  @IsBoolean() visible!: boolean;
}
class CapabilityDetailsDto {
  @IsDefined() @IsObject() @ValidateNested() @Type(() => TechnologyDetailsDto) technology!: TechnologyDetailsDto;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => CompanyDetailsDto) company!: CompanyDetailsDto;
  // 按项目稳定ID去重，保存数组顺序；逐项对象校验防止数组嵌套绕过字段约束。
  @IsArray() @ArrayMaxSize(12) @IsObject({ each: true }) @ArrayUnique((item: CapabilityProjectDto) => item?.id) @ValidateNested({ each: true }) @Type(() => CapabilityProjectDto) projects!: CapabilityProjectDto[];
}
export class SiteContentDto {
  @IsDefined() @IsObject() @ValidateNested() @Type(() => ProfileDto) profile!: ProfileDto;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => HomeDto) home!: HomeDto;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => ContactDto) contact!: ContactDto;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => AppearanceDto) appearance!: AppearanceDto;
  // 默认值只用于旧客户端省略music；显式null/数组仍经过IsObject和嵌套规则拒绝。
  @IsDefined() @IsObject() @ValidateNested() @Type(() => MusicDto) music: MusicDto = Object.assign(new MusicDto(), defaultSiteMusic());
  // 仅整个分区缺失时给旧客户端九项默认；默认项也转换为真实嵌套DTO，沿用相同白名单校验。
  @IsDefined() @IsObject() @ValidateNested() @Type(() => CapabilitiesDto) capabilities: CapabilitiesDto = plainToInstance(CapabilitiesDto, defaultSiteCapabilities());
  // 新分区仅GET兼容缺失；PUT必须完整提交，避免旧客户端整站保存把已有履历清成默认。
  @IsDefined() @IsObject() @ValidateNested() @Type(() => CapabilityDetailsDto) capabilityDetails!: CapabilityDetailsDto;
}
export class SaveSiteDto {
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER - 1) version!: number;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => SiteContentDto) content!: SiteContentDto;
}
