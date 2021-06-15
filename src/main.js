import Vue from 'vue'
import App from './App.vue'
import router from './router'
import 'normalize.css'
import '@/assets/scss/style.scss'

const baseServerUrl=process.env.NODE_ENV=='development'? 'https://localhost:44329' :'https://diplom-server.azurewebsites.net' ;
const baseClientUrl= process.env.NODE_ENV=='development'? 'http://localhost:8080':'https://diplom.westeurope.cloudapp.azure.com';
const webrtcServer =process.env.NODE_ENV=='development'? 'ws://localhost:3000': 'wss://bscure-hollows-66091.herokuapp.com';

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


