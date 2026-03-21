// src/scripts/context.js

export function getChattContext(locationLike) {
    const url = new URL(locationLike.href ?? String(locationLike));

    const isSewerPaymentsChatt =
        url.hostname === 'www.sewerpayments.com' && url.pathname.startsWith('/chattanooga');

    const isDwcorpWebShare =
        url.hostname === 'share.dwcorp.com' && url.pathname.toLowerCase().startsWith('/webshare');

    const params = url.searchParams;
    const isChattClient = params.get('clientKey') === '3652' && params.get('viewID') === '3';
    const isChattWebShare = isDwcorpWebShare && isChattClient;

    const path = url.pathname.toLowerCase();

    const isLogin = path.endsWith('/login.aspx') || path.includes('/login');
    const isForgotUserName =
        path.endsWith('/webshare/anonymous/forgotusername.aspx') ||
        path.includes('/forgotusername');
    const isNewUser =
        path.endsWith('/webshare/anonymous/newuser.aspx') || path.includes('/newuser');
    const isGuestPay =
        path.endsWith('/webshare/anonymous/guestpay.aspx') || path.includes('/guestpay');

    let pageType = null;
    if (isLogin) pageType = 'login';
    else if (isForgotUserName) pageType = 'forgot-username';
    else if (isNewUser) pageType = 'new-user';
    else if (isGuestPay) pageType = 'guest-pay';
    else if (isChattWebShare) pageType = 'dashboard';

    const isRelevant = isSewerPaymentsChatt || isChattWebShare;

    return {
        url,
        isRelevant,
        isSewerPaymentsChatt,
        isChattWebShare,
        pageType,
    };
}
