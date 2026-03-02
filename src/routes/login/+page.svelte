<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import {
    Mail,
    Lock,
    ArrowRight,
    CheckCircle2,
    Languages,
    X,
  } from "lucide-svelte";
  import favicon from "$lib/assets/favicon.svg";
  import LanguagePicker from "$lib/components/LanguagePicker.svelte";

  import { user } from "$lib/stores/auth";
  import { api } from "$lib/apis";
  import { _ } from "$lib/i18n";

  let email = "";
  let password = "";
  let loading = false;
  let error = "";

  let showPrivacyModal = false;
  let showTermsModal = false;

  async function handleLogin() {
    loading = true;
    error = "";

    try {
      const res = await api.auth.login(email, password);

      const data = await res.json();

      if (res.ok) {
        // Set cookie on client side
        document.cookie = `_khun_ph_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=Lax`;

        const userEmail = data.email || email;
        const userId = data.id || "";
        const userUuid = data.user_id || "";
        const userRole = data.role || "user";
        const profile = data.profile;

        localStorage.setItem("user_email", userEmail);
        if (userId) localStorage.setItem("user_id", userId);
        if (userUuid) localStorage.setItem("user_uuid", userUuid);
        localStorage.setItem("user_role", userRole);
        if (profile)
          localStorage.setItem("user_profile", JSON.stringify(profile));

        user.set({
          id: userId,
          email: userEmail,
          user_id: userUuid,
          role: userRole,
          profile: profile,
        });
        goto(`${base}/dashboard`);
      } else {
        error = data.error || $_("login__error_default");
      }
    } catch (e) {
      error = $_("login__error_default");
    } finally {
      loading = false;
    }
  }

  $: valueProps = [
    $_("login__value_prop_1"),
    $_("login__value_prop_2"),
    $_("login__value_prop_3"),
  ];
</script>

<div class="h-screen w-full flex bg-[#030712] overflow-hidden font-sans">
  <!-- Left Pattern/Branding Section - Hidden on mobile -->
  <div
    class="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-[#0A0F1C] border-r border-white/5"
  >
    <!-- Animated Background Blur Effects -->
    <div
      class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none"
    >
      <div
        class="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-50"
      ></div>
      <div
        class="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-primary/15 rounded-full blur-[120px] mix-blend-screen opacity-50"
      ></div>
    </div>

    <div class="relative z-10">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 bg-gradient-to-tr from-primary/20 to-primary-dark/10 rounded-xl flex items-center justify-center ring-1 ring-primary/20 shadow-lg shadow-primary/20"
        >
          <img
            src={favicon}
            alt="Khun Phaen Logo"
            class="w-6 h-6 object-contain"
          />
        </div>
        <span class="text-2xl font-bold text-white tracking-tight"
          >{$_("login__brand_name")}</span
        >
      </div>
    </div>

    <div class="relative z-10 mb-10 pl-4">
      <h2
        class="text-5xl font-extrabold text-white mb-6 leading-[1.15] tracking-tight"
      >
        {$_("login__hero_title_1")} <br />
        <span
          class="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark"
          >{$_("login__hero_title_2")}</span
        >
      </h2>
      <p class="text-lg text-slate-400/90 max-w-md leading-relaxed mb-10">
        {$_("login__hero_desc")}
      </p>

      <div class="space-y-4">
        {#each valueProps as prop}
          <div class="flex items-center gap-3 text-slate-300">
            <CheckCircle2 class="w-5 h-5 text-primary" />
            <span class="font-medium text-sm">{prop}</span>
          </div>
        {/each}
      </div>
    </div>

    <div
      class="relative z-10 flex flex-wrap items-center gap-6 text-sm font-medium text-slate-500"
    >
      <div class="flex items-center gap-6">
        <button
          on:click={() => (showPrivacyModal = true)}
          type="button"
          class="hover:text-white transition-colors cursor-pointer"
          >{$_("login__link_privacy")}</button
        >
        <button
          on:click={() => (showTermsModal = true)}
          type="button"
          class="hover:text-white transition-colors cursor-pointer"
          >{$_("login__link_terms")}</button
        >
      </div>

      <div class="h-4 w-px bg-slate-700 hidden sm:block"></div>

      <div class="flex items-center gap-2 text-sm">
        <span>{$_("login__powered_by")}</span>
        <a
          href="https://fakduai.com/"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-white hover:text-primary transition-colors font-semibold group"
        >
          <img
            src="https://fakduai.com/favicon.ico"
            alt="Fakduai Logo"
            class="w-5 h-5 rounded-sm object-contain group-hover:scale-110 transition-transform bg-white/10 p-0.5"
          />
          Fakduai Logistic and Fakduai Digital platform
        </a>
      </div>
    </div>
  </div>

  <!-- Right Login Section -->
  <div
    class="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-[#030712]"
  >
    <!-- Mobile subtle background glow -->
    <div
      class="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none lg:hidden"
    >
      <div
        class="absolute top-1/4 left-1/2 -translate-x-1/2 w-full h-1/2 bg-primary/10 rounded-full blur-[100px] mix-blend-screen opacity-50"
      ></div>
    </div>

    <div class="absolute top-6 right-6 z-50">
      <LanguagePicker isDark={true} />
    </div>

    <div class="max-w-[420px] w-full relative z-10">
      <!-- Mobile Logo -->
      <div class="lg:hidden flex justify-center mb-8">
        <div
          class="w-12 h-12 bg-gradient-to-tr from-primary/20 to-primary-dark/10 rounded-2xl flex items-center justify-center ring-1 ring-primary/20 shadow-lg shadow-primary/20"
        >
          <img
            src={favicon}
            alt="Khun Phaen Logo"
            class="w-7 h-7 object-contain"
          />
        </div>
      </div>

      <div class="text-center lg:text-left mb-10">
        <h1 class="text-3xl font-bold text-white mb-3 tracking-tight">
          {$_("login__title")}
        </h1>
        <p class="text-slate-400 text-sm">{$_("login__subtitle")}</p>
      </div>

      <form on:submit|preventDefault={handleLogin} class="space-y-5">
        <div>
          <label
            for="email"
            class="block text-sm font-medium text-slate-300 mb-2"
            >{$_("login__email_label")}</label
          >
          <div class="relative group">
            <div
              class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors"
            >
              <Mail size={18} />
            </div>
            <input
              type="email"
              id="email"
              bind:value={email}
              required
              placeholder={$_("login__email_placeholder")}
              class="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-300"
            />
          </div>
        </div>

        <div>
          <label
            for="password"
            class="block text-sm font-medium text-slate-300 mb-2"
            >{$_("login__password_label")}</label
          >
          <div class="relative group">
            <div
              class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors"
            >
              <Lock size={18} />
            </div>
            <input
              type="password"
              id="password"
              bind:value={password}
              required
              placeholder="••••••••"
              class="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-300"
            />
          </div>
        </div>

        {#if error}
          <div
            class="bg-red-500/10 border border-red-500/20 text-red-500 text-sm py-3 px-4 rounded-xl flex items-center gap-2 animate-fade-in"
          >
            <svg
              class="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              /></svg
            >
            {error}
          </div>
        {/if}

        <button
          type="submit"
          disabled={loading}
          class="w-full py-3.5 px-4 mt-2 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all duration-300 flex items-center justify-center gap-2 group border border-transparent"
        >
          {#if loading}
            <div
              class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></div>
          {:else}
            {$_("login__btn_submit")}
            <ArrowRight
              size={18}
              class="group-hover:translate-x-1 transition-transform"
            />
          {/if}
        </button>
      </form>

      <div class="mt-8 text-center text-sm">
        <span class="text-slate-500">{$_("login__invitation_only")}</span>
      </div>
    </div>
  </div>
</div>

<!-- Privacy Modal -->
{#if showPrivacyModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    on:click={() => (showPrivacyModal = false)}
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-lg w-full shadow-2xl relative"
      on:click|stopPropagation
    >
      <button
        class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        on:click={() => (showPrivacyModal = false)}
      >
        <X size={20} />
      </button>
      <h2 class="text-xl font-bold text-white mb-4">
        {$_("login__privacy_title")}
      </h2>
      <div class="text-slate-300 text-sm leading-relaxed space-y-3">
        <p>{$_("login__privacy_content")}</p>
      </div>
    </div>
  </div>
{/if}

<!-- Terms Modal -->
{#if showTermsModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    on:click={() => (showTermsModal = false)}
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-lg w-full shadow-2xl relative"
      on:click|stopPropagation
    >
      <button
        class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        on:click={() => (showTermsModal = false)}
      >
        <X size={20} />
      </button>
      <h2 class="text-xl font-bold text-white mb-4">
        {$_("login__terms_title")}
      </h2>
      <div class="text-slate-300 text-sm leading-relaxed space-y-3">
        <p>{$_("login__terms_content")}</p>
      </div>
    </div>
  </div>
{/if}

<style>
  /* CSS Fix for WebKit Autofill replacing backgrounds */
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 30px #0f172a inset !important;
    -webkit-text-fill-color: white !important;
    caret-color: white !important;
    transition: background-color 5000s ease-in-out 0s;
  }
</style>
