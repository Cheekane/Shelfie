import { Text, View } from 'react-native';

interface EmptyStateProps {
    message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
    return (
        <View className="items-center py-10">
            <Text className="text-center text-slate-400">{message}</Text>
        </View>
    );
}
