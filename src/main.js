import Vue from 'vue'
import App from './App.vue'
import router from './router'
import 'normalize.css'
import '@/assets/scss/style.scss'

const baseServerUrl=process.env.NODE_ENV=='development'? 'https://localhost:44329' :'https://diplom-server.azurewebsites.net' ;
const baseClientUrl= process.env.NODE_ENV=='development'? 'http://localhost:8080':'https://diplom.westeurope.cloudapp.azure.com';
const webrtcServer =process.env.NODE_ENV=='development'? 'http://localhost:55666': 'https://websoket-server.na4u.ru';

export {
  baseServerUrl,
  baseClientUrl,
  webrtcServer
};

Vue.config.productionTip = false

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')


