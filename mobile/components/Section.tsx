import { Text, View } from 'react-native';


interface SectionProps {
    sectionName: string;
    className?: string;
}


export function Section({ sectionName, className }: SectionProps) {

    return (
        <View className={className ? className : "w-full h-32 border-2 border-gray-800 rounded-lg p-2"}>
            <Text className="font-gray-800">{sectionName}</Text>
        </View>
    );
}