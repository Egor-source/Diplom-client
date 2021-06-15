<template>
  <div class="card w-50">
    <p class="error mb_20" v-show="showErrors">{{ error }}</p>
    <form class="center mb_20" method="GET" @submit.prevent="sendForm">
      <input
        required
        v-model.trim="userData.login"
        :class="['inpText mb_20']"
        placeholder="Логин"
        type="text"
      />

      <input
        required
        v-model.trim="userData.password"
        :class="['inpText mb_20']"
        placeholder="Пароль"
        type="password"
      />

      <button :disabled="chekInputs" class="buttonPurple" type="submit">
        Войти
      </button>
    </form>
     <button  class="buttonPurple" @click="$router.push({name:'Create'})">
        Новая конференция
      </button>
  </div>
</template>

<script>
import { SHA3 } from "sha3";
import { baseServerUrl } from "../main";
export default {
  created() {
    let curUrl = new URL(window.location.href);
    if (!curUrl.searchParams.has("confirenceId")) {
      this.$router.push({ name: "Create" });
    }
    this.userData.confirenceId = curUrl.searchParams.get("confirenceId");

    let sessionsData = JSON.parse(localStorage.getItem("sessionsData"));

    if(sessionsData && sessionsData.find(session=>session.confirenceId==this.userData.confirenceId)){
      this.$router.push({
            name: "Conference",
            query: {
              confirenceId: this.userData.confirenceId,
            },
          });
    }

  },
  data() {
    return {
      userData: {
        confirenceId: "",
        login: "",
        password: "",
      },
      showErrors: false,
      error: "",
    };
  },
  computed: {
    //Проверка полей формы на заполненость
    chekInputs() {
      var emptyInputs = Object.values(this.userData).filter(
        (input) => input === ""
      );
      return emptyInputs.length > 0 ? true : false;
    },
  },
  methods: {
    async sendForm() {
      this.showErrors = false;
      let hash = new SHA3(512);
      hash.update(this.userData.password);
      this.userData.password = hash.digest("hex");

      try {
        let response = await fetch(`${baseServerUrl}/api/session/Login`, {
          method: "POST",
          body: JSON.stringify(this.userData),
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          let userRole = await response.text();

          let sessionsData = JSON.parse(localStorage.getItem("sessionsData"));

          if (!sessionsData) {
            sessionsData = [];
          }

          sessionsData.push({
            ...this.userData,
            userRole,
          });

          localStorage.setItem("sessionsData", JSON.stringify(sessionsData));

          this.$router.push({
            name: "Conference",
            query: {
              confirenceId: this.userData.confirenceId,
            },
          });
        } else {
          this.userData.password = "";
          throw new Error(await response.text());
        }
      } catch (e) {
        this.showErrors = true;
        this.error = e.message;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.w-50 {
  width: 50%;
}
</style>