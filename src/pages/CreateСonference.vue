<template>
  <div class="card">
    <form
      class="center"
      method="POST"
      @submit.prevent="sendForm"
      v-show="!computedSessionRegistration"
    >
      <h3>Данные администратора конференции</h3>
      <input
        required
        v-model.trim="sessionData.adminName"
        :class="['inpText mb_20']"
        placeholder="Логин администратора"
        type="text"
      />
      <div class="mb_20">
        <input
          required
          v-model.trim="sessionData.adminPassword"
          :class="[
            'inpText ',
            {
              invalid:
                $v.sessionData.adminPassword.$dirty &&
                !$v.sessionData.adminPassword.isValid,
            },
          ]"
          placeholder="Пароль администратора"
          type="password"
        />
        <p class="error" v-show="$v.sessionData.adminPassword.$error">
          Пароли не совпадают!
        </p>
      </div>
      <input
        required
        v-model.trim="confirm.confirmAdminPassword"
        class="inpText mb_20"
        placeholder="Подтверждение пароля "
        type="password"
      />
      <hr class="mb_20" />
      <h3>Данные обычных пользователей</h3>
      <div class="mb_20">
        <input
          required
          v-model.trim="sessionData.usersPassword"
          :class="[
            'inpText ',
            {
              invalid:
                $v.sessionData.usersPassword.$dirty &&
                !$v.sessionData.usersPassword.isValid,
            },
          ]"
          placeholder="Пароль для пользователей"
          type="password"
        />
        <p class="error" v-show="$v.sessionData.usersPassword.$error">
          Пароли не совпадают!
        </p>
      </div>
      <input
        required
        v-model.trim="confirm.confirmUsersPassword"
        class="inpText mb_20"
        placeholder="Подтверждение пароля "
        type="password"
      />
      <hr class="mb_20" />
      <h3>Дата проведения конференции</h3>
      <div class="mb_20">
        <input
          required
          :class="{
            invalid: $v.sessionData.date.$dirty && !$v.sessionData.date.isValid,
          }"
          type="datetime-local"
          v-model="sessionData.date"
        />
        <p class="error center" v-show="$v.sessionData.date.$error">
          Неверно указана дата!
        </p>
      </div>
      <button :disabled="chekInputs" class="buttonPurple" type="submit">
        Отправить
      </button>
    </form>

    <div class="center" v-show="computedSessionRegistration">
      <input class="inpText mb_20" type="text" readonly v-model="sessionUrl" />
      <!-- <p class="mb_20 green" v-show="urlСopied">Ссылка скопирована</p>
      <button class="buttonPurple mb_20" @click="copyToClipboard">
        Скопировать в буфер обмена
      </button> -->
      <button
        class="buttonPurple"
        @click="
          $router.push({
            name: 'Login',
            query: {
              confirenceId: sessionData.confirenceId,
            },
          })
        "
      >
        Перейти в конференцию
      </button>
    </div>
  </div>
</template>

<script>
import { v4 } from "uuid";
import { baseServerUrl, baseClientUrl } from "../main";
import { SHA3 } from "sha3";
import { validationMixin } from "vuelidate";
export default {
  mixins: [validationMixin],
  data() {
    return {
      sessionData: {
        confirenceId: v4(),
        adminName: "",
        adminPassword: "",
        usersPassword: "",
        date: "",
        conferenceStarted: false,
      },
      confirm: {
        confirmAdminPassword: "",
        confirmUsersPassword: "",
      },
      computedSessionRegistration: false,
      sessionUrl: "",
      // urlСopied: false,
    };
  },
  computed: {
    //Проверка полей формы на заполненость
    chekInputs() {
      var emptyInputs = Object.values(this.sessionData).filter(
        (input) => input === ""
      );
      return emptyInputs.length > 0 ? true : false;
    },
  },
  methods: {
    async sendForm() {
      this.$v.sessionData.$touch();

      if (this.$v.sessionData.$error) {
        return;
      }

      let adminPassword = this.sessionData.adminPassword;
      let usersPassword = this.sessionData.usersPassword;

      //Вычисление хэша для паролей
      let hash = new SHA3(512);
      hash.update(this.sessionData.adminPassword);
      this.sessionData.adminPassword = hash.digest("hex");
      hash.reset();
      hash.update(this.sessionData.usersPassword);
      this.sessionData.usersPassword = hash.digest("hex");

      try {
        //Отправка данных на сервер
        let response = await fetch(`${baseServerUrl}/api/session/Create`, {
          method: "POST",
          body: JSON.stringify(this.sessionData),
          headers: { "Content-Type": "application/json" },
        });

        this.sessionData.adminPassword = adminPassword;
        this.sessionData.usersPassword = usersPassword;

        if (response.ok) {
          //Создание URL конференции
          this.sessionUrl = `${baseClientUrl}/Login?confirenceId=${this.sessionData.confirenceId}`;
          this.computedSessionRegistration = true;
        } else {
          throw new Error(await response.text());
        }
      } catch (e) {
        alert(e.message);
      }
    },
    copyToClipboard() {
      let textarea = document.querySelector('.inpText');
      textarea.select();
      document.execCommand("copy");
      this.urlСopied=true;
    },
  },
  validations: {
    sessionData: {
      adminPassword: {
        isValid(value) {
          return value == this.confirm.confirmAdminPassword;
        },
      },
      usersPassword: {
        isValid(value) {
          return value == this.confirm.confirmUsersPassword;
        },
      },
      date: {
        isValid(value) {
          return new Date().toISOString() < value;
        },
      },
    },
  },
};
</script>

<style lang="scss" >
#app {
  min-height: 750px;
}

.card {
  width: 80%;
  min-width: 290px;
}

p {
  margin: 0;
}

.green {
  color: green;
}

@media screen and(max-height:780px) {
  #app {
    padding: 50px 0;
  }
}
</style>