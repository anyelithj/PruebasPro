# Next.js 16 — Estructura de Carpetas

## Tipo de Arquitectura

**MVC + Clean Architecture + Atomic Design + BFF (Backend for Frontend)**
---

## Estructura de Carpetas Completa

> Árbol generado desde la matriz `matriz_trazabilidad_tecnica_AulaDeIdiomas (6).xlsx` (hoja «📱 Next.js 16», columna «Carpeta / Archivo (FBA)»): ambos documentos listan los mismos archivos con los mismos nombres. La etiqueta `[CREAR | LISTAR | VER DETALLE | EDITAR | ELIMINAR]` indica qué operación CRUD atiende cada archivo; en la matriz no se repiten las carpetas porque ya aparecen en la ruta de cada archivo.

```
apps/frontend-next/                                       # MVC + Clean Architecture + Atomic Design: View=app/ · Controller=api/+hooks · Model=store/ · Infra=lib/
├── src/                                       
│   ├── app/                                   
│   │   ├── (auth)/                             
│   │   │   ├── forgot-password/                
│   │   │   │   └── page.tsx          
│   │   │   ├── login/                        
│   │   │   │   ├── loading.tsx                
│   │   │   │   ├── oauth-actions.ts     
│   │   │   │   └── page.tsx            
│   │   │   ├── register/                   
│   │   │   │   ├── loading.tsx                 
│   │   │   │   └── page.tsx                    
│   │   │   ├── reset-password/            
│   │   │   │   └── page.tsx                   
│   │   │   ├── terms/           
│   │   │   │   └── page.tsx                
│   │   │   ├── verify-email/                   
│   │   │   │   └── page.tsx                    
│   │   │   ├── layout.tsx             
│   │   │   └── page.tsx                        
│   │   ├── (portal)/                
│   │   │   ├── admin/
│   │   │   │   ├── activities/       
│   │   │   │   │   └── page.tsx       
│   │   │   │   ├── courses/               
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   └── edit/            
│   │   │   │   │   │       └── page.tsx
│   │   │   │   │   ├── new/           
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── actions.ts          
│   │   │   │   │   ├── CourseForm.tsx         
│   │   │   │   │   └── page.tsx        
│   │   │   │   ├── curriculum/    
│   │   │   │   │   ├── [id]/                   
│   │   │   │   │   │   ├── edit/              
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── page.tsx    
│   │   │   │   │   ├── new/            
│   │   │   │   │   │   └── page.tsx           
│   │   │   │   │   ├── tema/            
│   │   │   │   │   │   ├── editar/        
│   │   │   │   │   │   │   └── page.tsx        
│   │   │   │   │   │   └── page.tsx     
│   │   │   │   │   ├── actions.ts   
│   │   │   │   │   └── page.tsx            
│   │   │   │   ├── jobs/                    
│   │   │   │   │   ├── actions.ts              
│   │   │   │   │   ├── RunJobButton.ts
│   │   │   │   │   └── page.tsx          
│   │   │   │   ├── reports/                  
│   │   │   │   │   ├── page.tsx                
│   │   │   │   │   └── ReportsClient.tsx       
│   │   │   │   └── users/              
│   │   │   │       ├── [id]/                 
│   │   │   │       │   ├── edit/          
│   │   │   │       │   │   └── page.tsx  
│   │   │   │       │   └── page.tsx        
│   │   │   │       ├── new/        
│   │   │   │       │   └── page.tsx        
│   │   │   │       ├── page.tsx               
│   │   │   │       └── UserForm.tsx           
│   │   │   ├── assistant/                  
│   │   │   │   └── page.tsx                   
│   │   │   ├── courses/                     
│   │   │   │   ├── [id]/                       
│   │   │   │   │   ├── lessons/
│   │   │   │   │   │   └── [materialId]/       
│   │   │   │   │   │       └── page.tsx      
│   │   │   │   │   ├── loading.tsx           
│   │   │   │   │   └── page.tsx             
│   │   │   │   ├── loading.tsx            
│   │   │   │   └── page.tsx             
│   │   │   ├── dashboard/                
│   │   │   │   ├── admin/                 
│   │   │   │   │   └── page.tsx          
│   │   │   │   ├── docente/                   
│   │   │   │   │   └── page.tsx               
│   │   │   │   ├── estudiante/                
│   │   │   │   │   └── page.tsx              
│   │   │   │   ├── loading.tsx       
│   │   │   │   └── page.tsx           
│   │   │   ├── feedback/                  
│   │   │   │   └── page.tsx           
│   │   │   ├── leaderboard/                   
│   │   │   │   ├── loading.tsx                
│   │   │   │   └── page.tsx                    
│   │   │   ├── profile/                        
│   │   │   │   ├── [username]/  
│   │   │   │   │   └── page.tsx           
│   │   │   │   ├── edit/       
│   │   │   │   │   ├── actions.ts       
│   │   │   │   │   ├── AvatarCard.tsx     
│   │   │   │   │   ├── page.tsx               
│   │   │   │   │   └── ProfileEditForm.tsx   
│   │   │   │   ├── page.tsx                   
│   │   │   │   └── ProgressClient.tsx     
│   │   │   ├── quiz/                   
│   │   │   │   ├── [id]/                       
│   │   │   │   │   ├── edit/                  
│   │   │   │   │   │   └── page.tsx      
│   │   │   │   │   ├── play/                  
│   │   │   │   │   │   ├── page.tsx        
│   │   │   │   │   │   └── QuizPlayClient.tsx  
│   │   │   │   │   ├── results/               
│   │   │   │   │   │   └── page.tsx         
│   │   │   │   │   ├── loading.tsx             
│   │   │   │   │   ├── not-found.tsx 
│   │   │   │   │   └── page.tsx               
│   │   │   │   ├── create/               
│   │   │   │   │   ├── loading.tsx     
│   │   │   │   │   └── page.tsx   
│   │   │   │   ├── loading.tsx                 
│   │   │   │   └── page.tsx                   
│   │   │   ├── resources/      
│   │   │   │   ├── tema/                
│   │   │   │   │   └── page.tsx             
│   │   │   │   └── page.tsx        
│   │   │   ├── teacher/
│   │   │   │   ├── quizzes/                
│   │   │   │   │   └── page.tsx      
│   │   │   │   └── students/                
│   │   │   │       ├── [id]/
│   │   │   │       │   └── history/            
│   │   │   │       │       └── page.tsx        
│   │   │   │       └── page.tsx               
│   │   │   └── layout.tsx                     
│   │   ├── api/                         
│   │   │   ├── [...path]/                     
│   │   │   │   └── route.ts                    
│   │   │   ├── admin/
│   │   │   │   └── users/              
│   │   │   │       ├── [id]/                
│   │   │   │       │   ├── activate/      
│   │   │   │       │   │   └── route.ts 
│   │   │   │       │   └── route.ts    
│   │   │   │       └── route.ts    
│   │   │   ├── ai/                   
│   │   │   │   └── feedback/           
│   │   │   │       └── route.ts   
│   │   │   ├── audio/
│   │   │   │   └── route.ts              
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/             
│   │   │   │   │   └── route.ts        
│   │   │   │   ├── forgot-password/  
│   │   │   │   │   └── rout
│   │   │   │   ├── login/          
│   │   │   │   │   └── route.ts                
│   │   │   │   ├── logout/          
│   │   │   │   │   └── route.ts             
│   │   │   │   ├── magic-link/          
│   │   │   │   │   └── route.ts                
│   │   │   │   ├── me/          
│   │   │   │   │   └── route.ts                
│   │   │   │   ├── oauth/
│   │   │   │   │   ├── [provider]/            
│   │   │   │   │   │   └── route.ts           
│   │   │   │   │   └── bridge/            
│   │   │   │   │       └── route.ts            
│   │   │   │   ├── register/          
│   │   │   │   │   └── route.ts                
│   │   │   │   ├── request-verify-email/    
│   │   │   │   │   └── route.ts                
│   │   │   │   ├── reset-password/          
│   │   │   │   │   └── route.ts                
│   │   │   │   └── verify-email/         
│   │   │   │       └── route.ts              
│   │   │   ├── courses/
│   │   │   │   └── [courseId]/
│   │   │   │       ├── materials/            
│   │   │   │       │   ├── [id]/               
│   │   │   │       │   │   ├── file/           
│   │   │   │       │   │   │   └── route.ts    
│   │   │   │       │   │   └── route.ts        
│   │   │   │       │   └── route.ts            
│   │   │   │       ├── purchase/            
│   │   │   │       │   └── route.ts            
│   │   │   │       └── reaction/               
│   │   │   │           └── route.ts        
│   │   │   ├── curriculum/    
│   │   │   │   ├── [id]/           
│   │   │   │   │   ├── status/            
│   │   │   │   │   │   └── route.ts        
│   │   │   │   │   └── route.ts             
│   │   │   │   ├── ai/
│   │   │   │   │   ├── content/          
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── topics/          
│   │   │   │   │       └── route.ts           
│   │   │   │   ├── import-url/           
│   │   │   │   │   └── route.ts         
│   │   │   │   ├── key-check/           
│   │   │   │   │   └── route.ts           
│   │   │   │   ├── sources/           
│   │   │   │   │   └── route.ts           
│   │   │   │   ├── topics/           
│   │   │   │   │   └── route.ts              
│   │   │   │   └── route.ts                 
│   │   │   ├── dialogues/            
│   │   │   │   └── import-url/
│   │   │   │       └── route.ts   
│   │   │   ├── notifications/        
│   │   │   │   └── route.ts    
│   │   │   └── quiz/     
│   │   │       ├── [id]/         
│   │   │       │   ├── session/          
│   │   │       │   │   └── route.ts 
│   │   │       │   └── route.ts             
│   │   │       ├── ai/
│   │   │       │   └── generate/        
│   │   │       │       └── route.ts          
│   │   │       ├── session/
│   │   │       │   └── [sessionId]/
│   │   │       │       ├── answer/   
│   │   │       │       │   └── route.ts        
│   │   │       │       └── end/                
│   │   │       │           └── route.ts        
│   │   │       ├── sessions/
│   │   │       │   └── me/              
│   │   │       │       └── route.ts     
│   │   │       └── route.ts             
│   │   ├── idiomas/
│   │   │   └── [lang]/                         
│   │   │       └── page.tsx                  
│   │   ├── error.tsx                 
│   │   ├── favicon.ico             
│   │   ├── globals.css                      
│   │   ├── landing.css     
│   │   ├── layout.tsx                          
│   │   ├── not-found.tsx      
│   │   ├── page.tsx            
│   │   ├── robots.ts                         
│   │   └── sitemap.ts                    
│   ├── components/               
│   │   ├── admin/
│   │   │   ├── DeactivateUserButton.tsx 
│   │   │   └── RowActions.tsx      
│   │   ├── ai/                            
│   │   │   ├── AssistantChat.tsx               
│   │   │   ├── FeedbackPanel.tsx           
│   │   │   ├── RecommendationCard.tsx      
│   │   │   └── WeaknessChart.tsx      
│   │   ├── auth/          
│   │   │   ├── ForgotPasswordForm.tsx        
│   │   │   ├── LoginForm.tsx                 
│   │   │   ├── LogoutButton.tsx  
│   │   │   ├── OAuthButtons.tsx      
│   │   │   ├── ProtectedRoute.tsx              
│   │   │   ├── RegisterForm.tsx                
│   │   │   ├── ResetPasswordForm.tsx        
│   │   │   └── VerifyEmailForm.tsx             
│   │   ├── courses/
│   │   │   ├── CourseActions.tsx       
│   │   │   ├── CourseBadge.tsx       
│   │   │   ├── CourseCard.tsx       
│   │   │   ├── CourseFilter.tsx       
│   │   │   ├── CourseGrid.tsx       
│   │   │   ├── CourseLesson.tsx                
│   │   │   ├── CourseMaterials.tsx       
│   │   │   ├── CoursePrice.tsx       
│   │   │   ├── PdfReader.tsx       
│   │   │   └── SyllabusList.tsx                
│   │   ├── curriculum/
│   │   │   ├── CatalogCreatePanels.tsx       
│   │   │   ├── ContentEditor.tsx       
│   │   │   ├── ContradictionScanButton.tsx    
│   │   │   ├── CurriculumBadges.tsx       
│   │   │   ├── CurriculumItemForm.tsx         
│   │   │   ├── GenerationTrace.tsx     
│   │   │   ├── ImportPanel.tsx         
│   │   │   ├── ResourcePreview.tsx     
│   │   │   ├── ReviewStatusActions.tsx  
│   │   │   ├── SearchSelect.tsx              
│   │   │   └── SpeakButton.tsx         
│   │   ├── landing/
│   │   │   ├── CtaFooter.tsx       
│   │   │   ├── FaqSection.tsx
│   │   │   ├── Hero.tsx        
│   │   │   ├── HowItWorks.tsx               
│   │   │   ├── LanguagesGrid.tsx  
│   │   │   ├── LevelsMcer.tsx     
│   │   │   ├── LocalAiPrivacy.tsx         
│   │   │   └── Pricing.tsx                
│   │   ├── language/
│   │   │   ├── AccentPreference.tsx          
│   │   │   ├── IpaTextHost.tsx                 
│   │   │   ├── PolyglotNavLink.tsx          
│   │   │   ├── ResourceVocabularyField.tsx 
│   │   │   ├── TopicTitle.tsx         
│   │   │   └── WordLookupHost.tsx   
│   │   ├── layout/                      
│   │   │   ├── Footer.tsx               
│   │   │   ├── Navbar.tsx                      
│   │   │   ├── PageHeader.tsx          
│   │   │   ├── PreferencesProvider.tsx  
│   │   │   ├── PublicNavbar.tsx                
│   │   │   ├── Sidebar.tsx                     
│   │   │   └── ThemeProvider.tsx            
│   │   ├── leaderboard/               
│   │   │   ├── LeaderboardTable.tsx          
│   │   │   ├── RankBadge.tsx                
│   │   │   └── UserRankRow.tsx   
│   │   ├── portal/       
│   │   │   ├── AnalyticsFilters.tsx        
│   │   │   ├── ChartBars.tsx        
│   │   │   ├── Donut.tsx        
│   │   │   ├── Dropdown.tsx        
│   │   │   ├── ManagementHeader.tsx 
│   │   │   ├── MobileNav.tsx        
│   │   │   ├── Panel.tsx         
│   │   │   ├─
│   │   │   ├── P
│   │   │   ├── PortalToolbar.tsx        
│   │   │   ├── PortalTopbar.tsx        
│   │   │   ├── quiz-format.ts                  
│   │   │   ├── RecItem.tsx         
│   │   │   ├── StatCard.tsx              
│   │   │   ├── Tag.tsx     
│   │   │   └── Topbar.tsx                
│   │   ├── quiz/                 
│   │   │   ├── AnswerOption.tsx                
│   │   │   ├── CategoryIcon.tsx            
│   │   │   ├── DifficultyBadge.tsx 
│   │   │   ├── QuestionCard.tsx           
│   │   │   ├── QuizActions.tsx   
│   │   │   ├── QuizAdminTable.tsx          
│   │   │   ├── QuizCard.tsx             
│   │   │   ├── QuizFilter.tsx       
│   │   │   ├── QuizForm.tsx                    
│   │   │   ├── QuizGrid.tsx            
│   │   │   ├── QuizProgress.tsx              
│   │   │   ├── ScoreDisplay.tsx                
│   │   │   └── TimerBar.tsx                    
│   │   ├── shared/              
│   │   │   ├── AngularElements.tsx     
│   │   │   ├── ConfirmDialog.tsx              
│   │   │   ├── EmptyState.tsx         
│   │   │   ├── ErrorBoundary.tsx 
│   │   │   ├── LoadingSpinner.tsx          
│   │   │   ├── Pagination.tsx   
│   │   │   ├── ResultDialog.tsx             
│   │   │   ├── Toaster.tsx    
│   │   │   ├── SearchBar.tsx                  
│   │   │   └── SEOHead.tsx     
│   │   └── ui/                  
│   │       ├── avatar.tsx                 
│   │       ├── badge.tsx                    
│   │       ├── button.tsx                  
│   │       ├── button.stories.tsx              
│   │       ├── card.tsx                   
│   │       ├── dialog.tsx              
│   │       ├── input.tsx                   
│   │       ├── input.stories.tsx       
│   │       ├── label.tsx               
│   │       ├── password-input.tsx     
│   │       ├── progress.tsx                    
│   │       ├── select.tsx                     
│   │       ├── separator.tsx            
│   │       ├── skeleton.tsx                   
│   │       ├── tabs.tsx                       
│   │       ├── toast.tsx                 
│   │       └── tooltip.tsx           
│   ├── config/             
│   │   ├── angular.ts           
│   │   ├── brand.ts                        
│   │   └── curriculum-topics.ts               
│   ├── hooks/                      
│   │   ├── useAuth.ts                    
│   │   ├── useCart.ts
│   │   ├── useCourses.ts                
│   │   ├── useDebounce.ts                    
│   │   ├── useKeyboard.ts          
│   │   ├── useLocalStorage.ts              
│   │   ├── useMediaQuery.ts 
│   │   ├── useProfile.ts                      
│   │   ├── useQuiz.ts                          
│   │   ├── useSSE.ts                        
│   │   └── useTimer.ts                     
│   ├── lib/                          
│   │   ├── bff/                      
│   │   │   └── forward.ts                      
│   │   ├── api-client.ts           
│   │   ├── auth-config.ts             
│   │   ├── auth-nextauth.ts     
│   │   ├── auth.ts                             
│   │   ├── bff.ts                 
│   │   ├── categories.ts       
│   │   ├── constants.ts               
│   │   ├── courses-api.ts                
│   │   ├── curriculum-api.ts                
│   │   ├── errors.ts      
│   │   ├── help-api.ts           
│   │   
│   │   ├── languages.ts        
│   │   ├── materials-client.ts            
│   │   ├── oauth-bridge.ts            
│   │   ├── pdf-text.ts                        
│   │   ├── period.ts             
│   │   ├── profile-api.ts                   
│   │   ├── purchase-actions.ts  
│   │   ├── quiz-api.ts              
│   │   ├── resource-import.ts        
│   │   ├── safe-fetch.ts              
│   │   ├── seo.ts                            
│   │   ├── slug.ts            
│   │   ├── speech.ts          
│   │   ├── stream-proxy.ts      
│   │   ├── utils.ts                     
│   │   └── validations.ts                     
│   ├── store/                 
│   │   ├── api/                     
│   │   │   ├── aiApi.ts                    
│   │   │   ├── authApi.ts    
│   │   │   ├── baseApi.ts           
│   │   │   ├── coursesApi.ts             
│   │   │   ├── quizApi.ts                  
│   │   │   └── scoreApi.ts            
│   │   ├── slices/               
│   │   │   ├── authSlice.ts                
│   │   │   ├── coursesSlice.ts             
│   │   │   ├── quizSlice.ts            
│   │   │   ├── timerSlice.ts         
│   │   │   └── uiSlice.ts         
│   │   ├── index.ts                      
│   │   └── provider.tsx                        
│   ├── types/                                 
│   │   ├── angular-elements.d.ts            
│   │   ├── courses.ts    
│   │   ├── curriculum.ts    
│   │   ├── env.d.ts               
│   │   ├── global.d.ts       
│   │   ├── next-auth.d.ts         
│   │   ├── profile.ts    
│   │   └── quiz.ts    
│   ├── auth.config.ts                   
│   ├── auth.ts                           
│   └── proxy.ts     
├── __tests__/                         
│   ├── functional/  
│   │   ├── admin-users-section.spec.ts       
│   │   ├── ai-feedback.spec.ts              
│   │   ├── ai-quiz-generation.spec.ts        
│   │   ├── auth.spec.ts                 
│   │   ├── dark-mode.spec.ts                 
│   │   ├── leaderboard.spec.ts    
│   │   ├── navigation.spec.ts     
│   │   ├── protected-routes.spec.ts       
│   │   ├── quiz-flow.spec.ts               
│   │   └── session-expiry.spec.ts            
│   ├── integration/                           
│   │   ├── AssistantChat.test.tsx              
│   │   ├── AuthFlow.test.tsx                  
│   │   ├── FeedbackPanel.test.tsx             
│   │   ├── Leaderboard.test.tsx             
│   │   ├── QuizPage.test.tsx                  
│   │   ├── QuizPlay.test.tsx                   
│   │   └── UserAdminSection.test.tsx 
│   ├── performance/                   
│   │   ├── bundle.analysis.ts              
│   │   ├── landing.perf.spec.ts             
│   │   ├── lighthouse.config.js               
│   │   ├── navigation.perf.spec.ts          
│   │   └── quiz-page.perf.spec.ts    
│   ├── unit/                                
│   │   ├── a11y/
│   │   │   ├── atoms.a11y.test.tsx      
│   │   │   └── molecules.a11y.test.tsx   
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   │   ├── NewUserPage.test.tsx  
│   │   │   │   └── UserForm.test.tsx           
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.test.tsx     
│   │   │   │   ├── OAuthButtons.test.tsx
│   │   │   │   └── RegisterForm.test.tsx   
│   │   │   ├── language/
│   │   │   │   ├── ResourceVocabularyField.test.tsx  
│   │   │   │   └── WordLookupHost.test.tsx     
│   │   │   ├── portal/
│   │   │   │   └── AnalyticsFilters.test.tsx
│   │   │   ├── quiz/
│   │   │   │   ├── AnswerOption.test.tsx 
│   │   │   │   ├── QuestionCard.test.tsx       
│   │   │   │   ├── ScoreDisplay.test.tsx      
│   │   │   │   └── TimerBar.test.tsx         
│   │   │   ├── shared/
│   │   │   │   ├── EmptyState.test.tsx 
│   │   │   │   └── ErrorBoundary.test.tsx 
│   │   │   └── ui/
│   │   │       ├── button.test.tsx       
│   │   │       ├── dialog.test.tsx            
│   │   │       └── input.test.tsx              
│   │   ├── hooks/
│   │   │   ├── useAuth.test.ts            
│   │   │   ├── useDebounce.test.ts        
│   │   │   ├── useLocalStorage.test.ts   
│   │   │   └── useTimer.test.ts             
│   │   ├── lib/
│   │   │   ├── categories.test.ts              
│   │   │   ├── forward.test.ts                 
│   │   │   ├── languages.test.ts               
│   │   │   ├── materials.test.ts          
│   │   │   ├── period.test.ts               
│   │   │   ├── resource-import.test.ts        
│   │   │   ├── safe-fetch.test.ts              
│   │   │   ├── slug.test.ts                   
│   │   │   ├── stream-proxy.test.ts            
│   │   │   ├── utils.test.ts                 
│   │   │   └── validations.test.ts            
│   │   ├── store/
│   │   │   ├── authSlice.test.ts             
│   │   │   ├── quizSlice.test.ts               
│   │   │   └── timerSlice.test.ts           
│   │   └── test-utils.tsx                    
│   └── usability/                          
│       ├── accessibility.spec.ts               
│       ├── cross-browser.spec.ts             
│       ├── dark-mode-contrast.spec.ts       
│       ├── error-handling-ux.spec.ts           
│       ├── i18n.spec.ts                       
│       ├── keyboard-nav.spec.ts         
│       └── responsive.spec.ts                 
├── public/
│   ├── fonts/                                  
│   ├── icons/                       
│   └── images/                               
├── .storybook/                              
│   ├── main.ts                                 
│   └── preview.tsx                           
├── .env.example        
├── .env.local                      
├── components.json          
├── jest.config.ts                              
├── jest.setup.ts    
├── lighthouserc.js                 
├── next.config.ts     
├── package.json     
├── playwright.config.ts                        
├── tailwind.config.ts                       
└── tsconfig.json                         
packages/                                       
├── api-client/
│   ├── generated.ts                 
│   └── index.ts              
├── eslint-config/
│   └── index.js                 
├── shared-i18n/
│   ├── en.json       
│   ├── es.json                       
│   └── index.ts                      
├── shared-nav/
│   └── navigation.ts               
├── shared-schemas/
│   └── index.ts             
└── ui-tokens/
    ├── motion.css             
    └── tailwind-preset.ts           
```

## Convenciones CRUD y reutilización de formularios (iguales en la matriz)

Cada entidad con pantalla de gestión sigue **la misma forma de carpetas**; el segmento dice qué hace la ruta:

| Segmento | Acción | Página | Componente que monta |
|----------|--------|--------|----------------------|
| `<módulo>/` | **LISTAR** (tabla o tarjetas con acciones por fila) | `page.tsx` | tabla/lista del módulo |
| `<módulo>/new/` | **CREAR** (formulario en blanco) | `new/page.tsx` | `<Entidad>Form mode="create"` |
| `<módulo>/[id]/` | **VER DETALLE** (solo lectura) + botón **ELIMINAR** | `[id]/page.tsx` | `<Entidad>Form mode="view"` |
| `<módulo>/[id]/edit/` | **EDITAR** (formulario cargado con los datos) | `[id]/edit/page.tsx` | `<Entidad>Form mode="edit"` |
| `<módulo>/actions.ts` | Mutaciones | Server Actions | `create<Entidad>Action` · `update<Entidad>Action` · `delete<Entidad>Action` |

- **Un solo formulario por entidad** (DRY), con el nombre y la ubicación que tiene en el código: `admin/users/UserForm.tsx`, `admin/courses/CourseForm.tsx`, `profile/edit/ProfileEditForm.tsx`, `components/quiz/QuizForm.tsx`, `components/curriculum/CurriculumItemForm.tsx`. Tiene los mismos campos en los tres modos; las páginas solo **cargan** los datos (o no, si es crear) y eligen el `mode`; el formulario decide si los campos son editables y a qué Server Action envía.
- Nombres: carpeta y archivos en inglés; componentes en PascalCase con el nombre de la entidad (`<Entidad>Form`, `<Entidad>Card`, `<Entidad>Table`); `lib/<módulo>-api.ts` para la fachada HTTP; `types/<módulo>.ts`.
- Segmentos tal como están en el código: `new/` y `[id]/edit/` en users, courses y curriculum; `quiz/create/`, `curriculum/tema/` (`tema/editar/`), `resources/tema/` y `dashboard/docente|estudiante/` conservan su nombre porque cambiarlo cambia las URL públicas.

**Nombres cortos y con sentido:** verbo + entidad, máximo unas 3 palabras antes del sufijo técnico; sin librerías, «my» ni detalles internos en el nombre (`link-wallet.use-case.ts`, no `verify-siwe-and-link-wallet.use-case.ts`; `get-audio`, no `get-or-create-audio`; `whisper_transcriber.py`, no `faster_whisper_transcriber.py`).

## Patrones React Aplicados en la Estructura

### Patrones de Componentes (patterns.dev/react)

| Patrón | Dónde en la estructura | Implementación |
|--------|----------------------|----------------|
| **HOC Pattern** | `components/auth/ProtectedRoute.tsx` | `withAuth(Component)` redirige si no hay sesión; `withRoles(Component)` oculta por rol |
| **Hooks Pattern** | `hooks/` — todos los archivos | `useTimer`, `useAuth`, `useQuiz`, `useSSE`, `useDebounce` extraen lógica reutilizable |
| **Compound Pattern** | `components/quiz/QuizCard.tsx` | `QuizCard.Root + QuizCard.Header + QuizCard.Body` comparten estado sin prop drilling |
| **Container/Presentational** | `app/(portal)/quiz/page.tsx` + `components/quiz/QuizGrid.tsx` | Page = Container (fetch + estado); QuizGrid = Presentational (solo renderiza) |
| **Render Props Pattern** | `components/quiz/TimerBar.tsx` | `<Timer render={(time) => <TimerBar value={time} />} />` — lógica reutilizable con UI variable |

### Patrones de Renderizado (Next.js 16 App Router)

| Patrón | Sigla | Archivos que lo usan |
|--------|-------|----------------------|
| Client-Side Rendering | CSR | `quiz/[id]/play/page.tsx` · `assistant/page.tsx` · `profile/edit/page.tsx` |
| Server-Side Rendering | SSR | `dashboard/page.tsx` · `quiz/page.tsx` · `quiz/[id]/results/page.tsx` |
| Static Rendering | SSG | `(auth)/page.tsx` (landing) · `(auth)/terms/page.tsx` · `not-found.tsx` |
| Incremental Static Generation | ISR | `leaderboard/page.tsx` (revalidate: 60s) · `quiz/[id]/page.tsx` |
| Progressive Hydration | — | `components/ai/WeaknessChart.tsx` · `components/ai/AssistantChat.tsx` |
| Streaming SSR | — | `app/layout.tsx` con Suspense boundaries · `loading.tsx` en cada ruta |
| React Server Components | RSC | `components/layout/Navbar.tsx` · `components/layout/Footer.tsx` · `components/leaderboard/LeaderboardTable.tsx` |
| Selective Hydration | — | Todos los componentes sin `'use client'` — hidratados solo si hay interactividad |

### AI UI Patterns y React Stack 2026

| Patrón | Archivo | Descripción |
|--------|---------|-------------|
| Streaming Response | `components/portal/PortalTopbar.tsx` + `hooks/useSSE.ts` + `lib/bff/forward.ts` | Avisos en tiempo real por SSE (Last-Event-ID) a través del BFF |
| Optimistic Updates | `store/slices/quizSlice.ts` | Mensaje usuario en chat antes de respuesta IA |
| Error Recovery | `components/shared/ErrorBoundary.tsx` | Captura fallos IA con CTA de reintento |
| Server Actions | `app/(portal)/profile/edit/page.tsx` | Mutación de perfil sin Route Handler explícita |
| Partial Prerendering | `next.config.ts` (experimental.ppr) | Shell estático + zonas dinámicas en stream |
| use() hook | Server Components con fetch | Lectura de Promises en RSC sin useEffect |
| useTransition | `app/(portal)/quiz/[id]/play/page.tsx` | Navegación entre preguntas sin bloquear UI |

---

## Diccionario de Abreviaturas — Next.js

| Abrev. | Componente completo | Patrón de Diseño | Paradigma | Tecnología |
|--------|---------------------|------------------|-----------|------------|
| `btn` | Button | Decorator (CVA variantes) | Declarativo | shadcn/ui + Tailwind |
| `inp` | Input | Decorator (a11y label) | Declarativo | shadcn/ui |
| `crd` | Card | Composite Component | Declarativo | shadcn/ui + Radix |
| `dlg` | Dialog | Portal + Proxy (focus trap) | Declarativo | Radix UI |
| `bdg` | Badge | Value Object visual | Declarativo | shadcn/ui |
| `prg` | Progress | Observer (aria-live) | Reactivo | Radix UI |
| `skl` | Skeleton | Null Object (loading state) | Declarativo | shadcn/ui |
| `tst` | Toast | Observer (notificaciones) | Reactivo | shadcn/ui |
| `ttp` | Tooltip | Decorator (aria) | Declarativo | Radix UI |
| `sel` | Select | Adapter (Radix → dominio) | Declarativo | Radix UI |
| `tab` | Tabs | State (tab activo) | Reactivo | Radix UI |
| `avt` | Avatar | Null Object (fallback iniciales) | Declarativo | Radix UI |
| `sep` | Separator | Presentational | Declarativo | Radix UI |
| `lbl` | Label | Decorator (htmlFor a11y) | Declarativo | Radix UI |
| `qzc` | QuizCard | Presentational Component | Declarativo | React + Tailwind |
| `qzg` | QuizGrid | Container Component | Declarativo | React + Tailwind |
| `qnc` | QuestionCard | Compound Component | Declarativo + Funcional | React |
| `ano` | AnswerOption | Strategy (estado visual) | Declarativo | React |
| `tmb` | TimerBar | Observer (aria-live) | Reactivo | React |
| `scd` | ScoreDisplay | Presentational | Declarativo | React |
| `dfb` | DifficultyBadge | Value Object visual | Declarativo | React + Tailwind |
| `cti` | CategoryIcon | Adapter (Lucide → dominio) | Declarativo | Lucide React |
| `qzf` | QuizFilter | URL State Pattern | Declarativo | Next.js Router |
| `qzp` | QuizProgress | Derived State | Funcional | React |
| `fbp` | FeedbackPanel | Observer (SSE) | Reactivo | React + EventSource |
| `rcc` | RecommendationCard | Presentational | Declarativo | React |
| `wkc` | WeaknessChart | Data Visualization | Declarativo | Recharts |
| `asc` | AssistantChat | Observer + Iterator (stream) | Reactivo | React + SSE |
| `lbt` | LeaderboardTable | Iterator (paginación) | Declarativo | React |
| `rnb` | RankBadge | Value Object visual | Declarativo | React |
| `urr` | UserRankRow | Presentational | Declarativo | React |
| `lgf` | LoginForm | Template Method (RHF+Zod) | Funcional | React Hook Form + Zod |
| `rgf` | RegisterForm | Multi-step State Machine | Reactivo | React Hook Form |
| `oab` | OAuthButtons | Strategy (provider) | Declarativo | NextAuth.js |
| `prt` | ProtectedRoute | HOC + Guard Pattern | Funcional | Next.js middleware |
| `nvb` | Navbar | Composite | Declarativo | React + Tailwind |
| `sdb` | Sidebar | Composite + Collapse State | Reactivo | React + Redux uiSlice |
| `ftr` | Footer | Presentational | Declarativo | React |
| `thp` | ThemeProvider | Observer (context) | Reactivo | next-themes |
| `pgh` | PageHeader | Composite + Breadcrumb | Declarativo | React |
| `erb` | ErrorBoundary | Error Boundary (React pattern) | OOP | React class component |
| `ems` | EmptyState | Null Object Pattern | Funcional | React |
| `lsp` | LoadingSpinner | Skeleton Pattern | Declarativo | React + Tailwind |
| `pgn` | Pagination | Iterator + URL State | Funcional | Next.js Router |
| `cfd` | ConfirmDialog | Command + Confirmation | Reactivo | Radix UI |
| `srb` | SearchBar | Debounce Pattern | Funcional | React Hook |
| `seo` | SEOHead | Decorator (metadata) | Declarativo | Next.js Metadata API |
| `ath` | authSlice | CQRS-like (read/write sep) | Reactivo | Redux Toolkit |
| `qzs` | quizSlice | State Machine + Immer | Reactivo | Redux Toolkit |
| `uis` | uiSlice | Observer | Reactivo | Redux Toolkit |
| `tms` | timerSlice | State Machine | Reactivo | Redux Toolkit |

## Leyenda de Prácticas Aplicadas

| Práctica | Dónde se aplica en la estructura |
|----------|----------------------------------|
| **SOLID — SRP** | 1 archivo = 1 responsabilidad (slice, use-case, hook, componente) |
| **SOLID — OCP** | Atoms shadcn/ui extensibles sin modificar via CVA variantes |
| **SOLID — DIP** | RTK Query: componentes dependen de la API abstracta, no de fetch directo |
| **DRY** | Hooks reutilizables, store/api/ centralizados, shared-types package |
| **Clean Code** | Nombres descriptivos, hooks < 50 líneas, componentes < 100 líneas |
| **Type-Safe** | TS strict:true, Zod runtime validation, RTK Query endpoints tipados |
| **SEO** | generateMetadata por página, sitemap.ts, robots.ts, JSON-LD, OG images |
| **A11y WCAG 2.1 AA** | aria-* en todos atoms, focus trap dialogs, skip-to-content, jest-axe CI |
| **Responsive** | Tailwind sm/md/lg/xl/2xl en todos los layouts, sidebar colapsa mobile |
| **Performance** | SSR/SSG, lazy loading, code splitting, self-hosted fonts, WebP images |
| **Rutas protegidas** | middleware.ts verifica JWT antes del render, redirect a /login |
| **Rutas públicas** | Grupo `(auth)/` sin middleware, SSG donde sea posible |

---

## Herramientas de Testing

| Librería | Tipo de Prueba | Para qué sirve |
|----------|---------------|----------------|
| Jest | Unitarias + Integración | Framework de testing: describe/it/expect, mocks, coverage, jsdom |
| @testing-library/react | Unitarias | Testing de componentes por comportamiento (accesibilidad-first) |
| @testing-library/user-event | Unitarias | Simulación realista de eventos: click, type, keyboard, focus |
| @testing-library/jest-dom | Unitarias | Matchers DOM: toBeVisible, toHaveClass, toHaveTextContent |
| jest-axe | Unitarias (a11y) | Detecta violaciones WCAG en componentes dentro de Jest |
| MSW (Mock Service Worker) | Integración | Intercepta APIs en tests de componentes sin servidor real |
| Playwright | Funcionales + Usabilidad | E2E: chromium, firefox, webkit; flujos, teclado, responsive |
| @playwright/test | Funcionales | Runner oficial con assertions, fixtures, reporters, retries |
| axe-playwright | Usabilidad (a11y) | Scan WCAG 2.1 AA completo en páginas reales con Playwright |
| Lighthouse CI | Rendimiento + Usabilidad | Core Web Vitals automatizado en CI: LCP, FID, CLS, TTI |
| @next/bundle-analyzer | Rendimiento | Análisis visual del bundle JS para optimización de chunks |

## Validación de Datos

| Stack | Librería | Por qué |
|-------|----------|---------|
| Frontend Next.js | **Zod** | Type-safe runtime validation en cliente y servidor; schemas reutilizables con React Hook Form |

## Herramientas de Calidad de Código

| Herramienta | Para qué |
|-------------|----------|
| ESLint + eslint-config-next | Linter con reglas específicas Next.js + TypeScript |
| @typescript-eslint/parser | Parser TypeScript para ESLint |
| Prettier + prettier-plugin-tailwindcss | Formateador de código + ordenamiento automático de clases Tailwind |
| TypeScript strict:true | Type checking estático — sin any implícito, strictNullChecks |
| lint-staged + husky | Pre-commit hooks: ejecuta ESLint + Prettier antes de cada commit |
