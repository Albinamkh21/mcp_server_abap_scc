import axios from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';


// 1. Вставь сюда данные из Service Key сервиса Connectivity
const conn = {
    
        "tenantmode": "dedicated",
        "token-type": [
          "xsuaa",
          "ias"
        ],
        "clientid": "sb-cloneffd670e1614b4ae0a66a97f7c14b8c71!b21283|connectivity!b12",
        "token_service_domain": "authentication.ap20.hana.ondemand.com",
        "credential-type": "binding-secret",
        "token_service_url": "https://central.authentication.ap20.hana.ondemand.com",
        "xsappname": "cloneffd670e1614b4ae0a66a97f7c14b8c71!b21283|connectivity!b12",
        "onpremise_proxy_ldap_port": "20001",
        "onpremise_socks5_proxy_port": "20004",
        "clientsecret": "8a45bca6-dcfe-4841-a29d-37607db7747b$QbG0cdfWT-3vSMpEN7tpDPLyxWJObTuiJYTFfXuZf4A=",
        "onpremise_proxy_http_port": "20003",
        "url": "https://central.authentication.ap20.hana.ondemand.com",
        "onpremise_proxy_host": "10.0.4.5",
        "uaadomain": "authentication.ap20.hana.ondemand.com",
        "onpremise_proxy_port": "20003",
        "verificationkey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmt9vWZo4o4Cfc8YVw4NW\ndNJ9DdoklbUpFJYLSmpJMhZkla04LLzSG4fWfu75uYgtDjknPUv8dFwSWC5d6OWz\nebxXIWVrdziYoRHCEcQuAoGrI+nrODf6fGdftUbR7WzykkCE+iC3/8NNRc7kTlWl\nkABlamy0Poo8frwNTHHHxQ1j0fumaj/3lUosjTl57xS+Gg+zeG/vtPbilsL6Sm35\nKGvzjYgrVuKWPgJ29vzO0ql3IDyPzMOAkTeaxzftmi5sni3P0L31BcTywSXnqmoO\nGztTXBXHm09EpfD3UYm2LudCbnY4CjyiqxiAHmI3rpemzkT6bvZ1eiOC7/e8olGp\ndwIDAQAB\n-----END PUBLIC KEY-----",
        "identityzone": "central",
        "tenantid": "be3dc70a-5375-49a0-98ea-56a119723f4a",
        "onpremise_proxy_rfc_port": "20001",
        "region_configuration_id": "cf-ap20"
      
};

// 2. Вставь сюда данные из Service Key сервиса Destination
const destinationCredentials = {
    "clientid": "sb-clone8bc5a13d0e1d4cc28f9cb345cf1fe487!b21283|destination-xsappname!b5",
        "credential-type": "binding-secret",
        "xsappname": "clone8bc5a13d0e1d4cc28f9cb345cf1fe487!b21283|destination-xsappname!b5",
        "clientsecret": "a333a3dc-b42f-4f46-af48-7873781de77a$1z2PWHJWFAKu3a8k0gYNT6uNAEwV-YorUDY0jrSZdv8=",
        "uri": "https://destination-configuration.cfapps.ap20.hana.ondemand.com",
        "url": "https://central.authentication.ap20.hana.ondemand.com",
        "uaadomain": "authentication.ap20.hana.ondemand.com",
        "instanceid": "8bc5a13d-0e1d-4cc2-8f9c-b345cf1fe487",
        "verificationkey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmt9vWZo4o4Cfc8YVw4NW\ndNJ9DdoklbUpFJYLSmpJMhZkla04LLzSG4fWfu75uYgtDjknPUv8dFwSWC5d6OWz\nebxXIWVrdziYoRHCEcQuAoGrI+nrODf6fGdftUbR7WzykkCE+iC3/8NNRc7kTlWl\nkABlamy0Poo8frwNTHHHxQ1j0fumaj/3lUosjTl57xS+Gg+zeG/vtPbilsL6Sm35\nKGvzjYgrVuKWPgJ29vzO0ql3IDyPzMOAkTeaxzftmi5sni3P0L31BcTywSXnqmoO\nGztTXBXHm09EpfD3UYm2LudCbnY4CjyiqxiAHmI3rpemzkT6bvZ1eiOC7/e8olGp\ndwIDAQAB\n-----END PUBLIC KEY-----",
        "identityzone": "central",
        "tenantid": "be3dc70a-5375-49a0-98ea-56a119723f4a"

};
// 2. ВАШИ ДАННЫЕ S/4HANA
const s4 = {
    url: "http://ah4:6767", // Virtual Host
    user: "DEVELOPER",
    pass: "ABAPtr2023#00"
};

async function start() {
    try {
      console.log("1. Получаем JWT токен от BTP...");
      
      // Формируем URL для OAuth токена
      const tokenUrl = `${conn.url}/oauth/token?grant_type=client_credentials`;
      const auth = Buffer.from(`${conn.clientid}:${conn.clientsecret}`).toString('base64');
      
      const tokenResponse = await axios.post(tokenUrl, null, {
        headers: { 
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      const jwtToken = tokenResponse.data.access_token;
      console.log("✅ Токен получен успешно.");
  
      console.log("2. Настраиваем прокси-туннель...");
      
      // Используем IP 10.0.4.5 и порт 20003 из твоего ключа
      const proxyUrl = `http://${conn.onpremise_proxy_host}:${conn.onpremise_proxy_http_port}`;
      
      const agent = new HttpProxyAgent(proxyUrl, {
        proxyHeaders: {
          'Proxy-Authorization': `Bearer ${jwtToken}`,
          'SAP-Connectivity-Authentication': `Bearer ${jwtToken}`
        }
      });
  
      console.log(`3. Запрашиваем S/4HANA (${s4.url}) через туннель...`);
      const s4Auth = Buffer.from(`${s4.user}:${s4.pass}`).toString('base64');
      
      const response = await axios.get(`${s4.url}/sap/bc/adt/discovery`, {
        httpAgent: agent,
        headers: {
          'Authorization': `Basic ${s4Auth}`,
          'Accept': 'application/xml'
        },
        // Важно: увеличим таймаут, так как туннель может "просыпаться"
        timeout: 10000 
      });
  
      console.log("🎉 ПОБЕДА! Соединение с S/4HANA установлено.");
      console.log("Статус ответа:", response.status);
      console.log("Фрагмент XML от ADT:");
      console.log(response.data.toString().substring(0, 300));
  
    } catch (error) {
      console.error("❌ ОШИБКА:");
      if (error.response) {
        console.error(`Код ошибки: ${error.response.status}`);
        console.error(`Детали:`, error.response.data);
      } else if (error.code === 'ENOTFOUND') {
        console.error("Ошибка DNS: Node.js все еще пытается найти 'ah4' сама.");
        console.error("Убедись, что в объекте 'conn' правильно указан хост 10.0.4.5.");
      } else {
        console.error(error.message);
      }
    }
  }
  
  start();