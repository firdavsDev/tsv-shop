export type InlineButton = { text: string; callback_data?: string; url?: string; web_app?: { url: string } };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };
