import type { ElementType } from "react";

type BaseNavItem = {
  titleKey: string;
  badge?: string;
  icon?: ElementType;
};

type NavLink = BaseNavItem & { url: string; items?: never };
type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: string })[];
  url?: never;
};
type NavItem = NavCollapsible | NavLink;
type NavGroup = { titleKey: string; items: NavItem[] };

export type { NavGroup, NavItem, NavCollapsible, NavLink };
