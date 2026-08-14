import { Text, View } from 'react-native';
import type { ReactNode } from 'react';

interface SectionProps {
    sectionName: string;
    className?: string;
    children?: ReactNode;
}

export function Section({ sectionName, className, children }: SectionProps) {
    return (
        <View className={className ? className : "w-full h-32 border-2 border-gray-800 rounded-lg p-2"}>
            <Text className="text-gray-800 text-lg font-bold">{sectionName}</Text>
            {children}
        </View>
    );
}