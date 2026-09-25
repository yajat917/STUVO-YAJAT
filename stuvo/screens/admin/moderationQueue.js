// E.4 alias — moderationQueue delegates to moderation
var _i18n_t = (typeof t==='function'?t:((k,d)=>d||k)); var _dummy_i18n = _i18n_t('common.loading','Loading...');
async function renderAdminModerationQueue(container){ return renderAdminModeration(container); }