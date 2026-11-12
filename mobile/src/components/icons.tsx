/** 线性图标集(§5:1.8px 描边、圆头圆角、24 viewBox、currentColor 语义由调用方传色)。
 *  路径取自设计稿 sprite(design/shike-app mine.html / theme.css),保持同族一致。 */
import Svg, { Circle, Path } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color: string;
}

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none' } as const);
const strokeProps = (color: string) => ({
  stroke: color,
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/** 右箭头(列表行) */
export function ChevronRightIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="m9 18 6-6-6-6" {...strokeProps(color)} />
    </Svg>
  );
}

/** 齿轮(设置) */
export function GearIcon({ size = 20, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"
        {...strokeProps(color)}
      />
      <Circle cx={12} cy={12} r={3} {...strokeProps(color)} />
    </Svg>
  );
}

/** 笔(私有食单) */
export function PenIcon({ size = 19, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M12 20h9" {...strokeProps(color)} />
      <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" {...strokeProps(color)} />
    </Svg>
  );
}

/** 书(审核) */
export function BookLineIcon({ size = 19, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" {...strokeProps(color)} />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" {...strokeProps(color)} />
    </Svg>
  );
}

/** 盾(用户管理) */
export function ShieldIcon({ size = 19, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" {...strokeProps(color)} />
    </Svg>
  );
}

/** 相机(头像更换) */
export function CameraIcon({ size = 12, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
        {...strokeProps(color)}
      />
      <Circle cx={12} cy={14} r={3.5} {...strokeProps(color)} />
    </Svg>
  );
}

/** 垃圾桶(删除) */
export function TrashIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6M5.5 6l.8 13a1.5 1.5 0 0 0 1.5 1.4h8.4a1.5 1.5 0 0 0 1.5-1.4l.8-13"
        {...strokeProps(color)}
      />
      <Path d="M10 10v6M14 10v6" {...strokeProps(color)} />
    </Svg>
  );
}

/** 放大镜(搜索) */
export function SearchIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx={11} cy={11} r={7} {...strokeProps(color)} />
      <Path d="m20 20-4.35-4.35" {...strokeProps(color)} />
    </Svg>
  );
}

/** 碗(菜品生成入口) */
export function BowlIcon({ size = 19, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M4 11h16v2.5a6.5 6.5 0 0 1-6.5 6.5h-3A6.5 6.5 0 0 1 4 13.5V11zM2.5 11h19"
        {...strokeProps(color)}
      />
    </Svg>
  );
}

/** 叶(食材流水线入口) */
export function LeafLineIcon({ size = 19, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M5.5 18.5C5.5 10.5 11 5 19.5 4.5c.4 8.5-5 14-14 14zM5.5 18.5c2.6-4.6 6-8 10.5-10.4"
        {...strokeProps(color)}
      />
    </Svg>
  );
}

/** 眼睛(私有食单「查看」操作) */
export function EyeIcon({ size = 14, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        {...strokeProps(color)}
      />
      <Circle cx={12} cy={12} r={3} {...strokeProps(color)} />
    </Svg>
  );
}

/** 对勾(可见性说明条) */
export function CheckIcon({ size = 20, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="m5 12 5 5L20 7" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
    </Svg>
  );
}

/** 省略号(列表行溢出操作菜单) */
export function DotsThreeIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx={5} cy={12} r={1.8} fill={color} />
      <Circle cx={12} cy={12} r={1.8} fill={color} />
      <Circle cx={19} cy={12} r={1.8} fill={color} />
    </Svg>
  );
}
