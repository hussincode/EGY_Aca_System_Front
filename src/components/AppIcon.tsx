import type { ComponentType, SVGProps } from "react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface AppIconProps extends SVGProps<SVGSVGElement> {
    icon: IconComponent;
    className?: string;
}

const AppIcon = ({ icon: Icon, className = "", ...props }: AppIconProps) => {
    return <Icon className={`h-5 w-5 text-slate-400 transition-colors duration-200 ${className}`} {...props} />;
};

export default AppIcon;
