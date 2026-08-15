import { Text, View } from 'react-native';

import type { LibraryBook } from '../types/api';

interface LibraryBookCardProps {
    book: LibraryBook;
}

export function LibraryBookCard({ book }: LibraryBookCardProps) {
    return (
        <View className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Text className="text-base font-semibold text-slate-900">{book.title}</Text>
            <Text className="text-sm text-slate-500">{book.author}</Text>
        </View>
    );
}
