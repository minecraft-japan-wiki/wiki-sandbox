import fetch from "node-fetch"
import * as core from "@actions/core";
import * as github from "@actions/github";

const MW_ENDPOINT = process.env.MW_ENDPOINT;
const MW_API = process.env.MW_API;
const MW_USERNAME = process.env.MW_USERNAME;
const MW_PASSWORD = process.env.MW_PASSWORD;
const MW_DIST_PAGE = process.env.MW_DIST_PAGE;
const MW_SOURCE_PAGE = process.env.MW_SOURCE_PAGE;


const cookieJar = [];

async function fetchWithCookies(url, options = {}) {
    options.headers = options.headers || {};
    options.headers.Cookie = cookieJar.join('; ');
    const response = await fetch(url, options);
    const setCookie = response.headers.raw()['set-cookie'] || [];
    setCookie.forEach(cookie => {
        const item = cookie.split(';')[0];
        const [name] = item.split('=');
        const index = cookieJar.findIndex(c => c.startsWith(name + '='));
        if (index !== -1) cookieJar[index] = item;
        else cookieJar.push(item);
    });
    return response;
}

async function main() {
    // Step 1: Get login token
    let res = await fetchWithCookies(`${MW_API}?action=query&meta=tokens&type=login&format=json`);
    let data = await res.json();
    const loginToken = data.query.tokens.logintoken;

    // Step 2: Login
    res = await fetchWithCookies(`${MW_API}?action=login&format=json`, {
        method: 'POST',
        body: new URLSearchParams({
            lgname: MW_USERNAME,
            lgpassword: MW_PASSWORD,
            lgtoken: loginToken
        }),
    });
    data = await res.json();
    if (data.login.result !== 'Success') {
        console.error('Login failed:', data);
        process.exit(1);
    }

    // Step 3: Get CSRF token
    res = await fetchWithCookies(`${MW_API}?action=query&meta=tokens&format=json`);
    data = await res.json();
    const csrfToken = data.query.tokens.csrftoken;

    // Step 4: Get content
    res = await fetchWithCookies(`${MW_ENDPOINT}wiki/${MW_SOURCE_PAGE}?action=raw`)
    const content = await res.text()

    // Step 5: Edit page
    res = await fetchWithCookies(`${MW_API}?format=json`, {
        method: 'POST',
        body: new URLSearchParams({
            action: 'edit',
            title: MW_DIST_PAGE,
            text: content,
            token: csrfToken,
            summary: 'Posted via GitHub Actions',
            bot: 'true'
        }),
    });
    data = await res.json();
    console.log('Edit response:', JSON.stringify(data, null, 2));

    if (data.edit && data.edit.result === 'Success') {
        console.log('✅ Page edited successfully');
    } else {
        console.error('❌ Failed to edit page');
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});