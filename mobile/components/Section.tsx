import { Text, View } from 'react-native';
import type { ReactNode } from 'react';

interface SectionProps {
    sectionName: string;
    className?: string;
    children?: ReactNode;
}

export function Section({ sectionName, className, children }: SectionProps) {
    return (
        <View className={className ?? "w-full gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"}>
            <Text className="text-lg font-semibold text-slate-900">{sectionName}</Text>
            {children}
        </View>
    );
}
