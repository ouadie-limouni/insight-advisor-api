import fetch from 'node-fetch';
import barchart from '@nebula.js/sn-bar-chart';
import line from '@nebula.js/sn-line-chart';
import scatterplot from '@nebula.js/sn-scatter-plot';
import EngineService from './cloud.engine';
import { embed } from '@nebula.js/stardust';


const charts = { barchart, linechart: line, scatterplot };
const tenantUrl = 'TENANT_URL HERE ';
const appId = 'APP_ID HERE';
const webIntegrationId = 'WEB_INTEGRATION_ID HERE';


const headers = {
  'accept-language': 'en',
  'Content-Type': 'application/json',
  'qlik-web-integration-id': webIntegrationId,
}; // headers to pass in requests

var chart = $('#chart');

$('#formId').submit(function (e) {
  e.preventDefault();
});

$(document).ready(() => {
  fetchMedata();
});

$('#btnSubmit').on('click', () => {
  chart.empty();
  const text = $('#inputText').val();
  const requestPayload = { fields: [], libItems: []};

  if (text) {
    requestPayload.text = text;
  }

  fetchRecommendationAndRenderChart(requestPayload);
});

async function fetchMedata() {
  // retrieve the analyses types for given application
  await getAnalyses();
  await getClassifications();
}

async function fetchRecommendationAndRenderChart(requestPayload) {
  // fetch recommendations for text or metadata
  const recommendations = await getRecommendation(requestPayload);

  const engineUrl = `${tenantUrl.replace('https', 'wss')}/app/${appId}`;
  // fetch rec options which has hypercubeDef
  const recommendation = recommendations.data.recAnalyses[0];
  // get csrf token
  const qcsHeaders = await getQCSHeaders();
  const engineService = new EngineService(engineUrl);
  // get openDoc handle
  const app = await engineService.getOpenDoc(appId, qcsHeaders);
  await renderHypercubeDef(app, recommendation);
}

async function renderHypercubeDef(app, recommendation) {
  const type = recommendation.chartType;

  const nebbie = embed(app, {
    types: [
      {
        name: type,
        load: async () => charts[type],
      },
    ],
  });

  document.querySelector('.curr-selections').innerHTML = '';
  (await nebbie.selections()).mount(document.querySelector('.curr-selections'));

  await nebbie.render({
    type: type,
    element: document.getElementById('chart'),
    properties: { ...recommendation.options },
    // fields: ["Month", "=sum(Sales)"],
  });
}

/**
 * rest api call for recommendations
 */
async function getRecommendation(requestPayload) {
  await qlikLogin(); // make sure you are logged in to your tenant
  // build url to execute recommendation call
  const endpointUrl = `${tenantUrl}/api/v1/apps/${appId}/insight-analyses/actions/recommend`;
  let data = {};
  // generate request payload
  if (requestPayload.text) {
    data = JSON.stringify({
      text: requestPayload.text,
    });
  } 

  const response = await fetch(endpointUrl, {
    credentials: "include",
    mode: "cors",
    method: 'POST',
    headers,
    body: data,
  });

  const recommendationResponse = await response.json();
  return recommendationResponse;
}

/**
 * rest api call for analyses
 */
async function getAnalyses() {
  await qlikLogin(); // make sure you are logged in to your tenant
  // build url to execute analyses call
  const endpointUrl = `${tenantUrl}/api/v1/apps/${appId}/insight-analyses`;
  const response = await fetch(endpointUrl, {
    credentials: "include",
    mode: "cors",
    method: 'GET',
    headers,
  });
  const analysesResponse = await response.json();
  return analysesResponse;
}

/**
 * rest api call to fetch metadata & classifications
 */
async function getClassifications() {
  await qlikLogin(); // make sure you are logged in to your tenant
  const qcsHeaders = await getQCSHeaders();
  headers["qlik-csrf-token"] = qcsHeaders["qlik-csrf-token"];
  // build url to execute classification call
  const endpointUrl = `${tenantUrl}/api/v1/apps/${appId}/insight-analyses/model`;
  const response = await fetch(endpointUrl, {
    credentials: "include",
    mode: "cors",
    method: 'GET',
    headers,
  });
  const classificationResponse = await response.json();
  return classificationResponse;
}

/**
 * rest api call to fetch the csrf token - refer: https://qlik.dev/tutorials/build-a-simple-web-app#ensure-your-user-is-signed-in-to-your-tenant
 * and https://qlik.dev/tutorials/managing-iframe-embedded-content-session-state-using-enigmajs-and-json-web-tokens
 */
async function getQCSHeaders() {
  await qlikLogin(); // enforce tenant login
  const response = await fetch(`${tenantUrl}/api/v1/csrf-token`, {
    mode: 'cors',
    credentials: 'include',
    headers: {
      'qlik-web-integration-id': webIntegrationId,
    },
  });

  const csrfToken = new Map(response.headers).get('qlik-csrf-token');
  return {
    'qlik-web-integration-id': webIntegrationId,
    'qlik-csrf-token': csrfToken,
  };
}

async function qlikLogin() {
  const loggedIn = await fetch(`${tenantUrl}/api/v1/users/me`, {
    mode: 'cors',
    credentials: 'include',
    headers: {
      'qlik-web-integration-id': webIntegrationId,
    },
  });
  if (loggedIn.status !== 200) {
    if (sessionStorage.getItem('tryQlikAuth') === null) {
      sessionStorage.setItem('tryQlikAuth', 1);
      window.location = `${tenantUrl}/login?qlik-web-integration-id=${webIntegrationId}&returnto=${location.href}`;
      return await new Promise((resolve) => setTimeout(resolve, 10000)); // prevents further code execution
    } else {
      sessionStorage.removeItem('tryQlikAuth');
      const message = 'Third-party cookies are not enabled in your browser settings and/or browser mode.';
      alert(message);
      throw new Error(message);
    }
  }
  sessionStorage.removeItem('tryQlikAuth');
  console.log('Logged in!');
  return true;
}
