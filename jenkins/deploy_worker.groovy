def branch = '';

pipeline {
    agent { 
        docker { 
            image 'docker-registry.kabala.tech/alpine-terraform:latest' 
            args '-v /var/run/docker.sock:/var/run/docker.sock:rw,z'
        } 
    }

    environment {
        CI = 'true'
        GIT_SSH_COMMAND = "ssh -o StrictHostKeyChecking=no"
        GH_TOKEN = credentials('jenkins-github-accesstoken')
        DOCKER_REGISTRY_USERNAME = credentials('docker-registry-username')
        DOCKER_REGISTRY_PASSWORD = credentials('docker-registry-password')
        AWS_ACCESS_KEY_ID = credentials('SCALEWAY_S3_ACCESS_KEY')
        AWS_SECRET_ACCESS_KEY = credentials('SCALEWAY_S3_ACCESS_SECRET_KEY')
        SENDGRID_API_KEY = credentials('sendgrid-gtms-qa')
    }

    stages {
        stage ('Set qa-master vars') {
            when {
                environment name: 'DEPLOY_ENVIRONMENT', value: 'qa-master'
            }
            steps {
                script {
                    withCredentials([
                        string(credentialsId: 'gtms-service-auth-qa-master-jwt-secrect', variable: 'JWT_SECRET'),
                        string(credentialsId: 'gtms-service-auth-qa-master-jwt-refresh-token-secrect', variable: 'JWT_REFRESH_TOKEN_SECRET')
                    ]) {
                        env.JWT_SECRET = JWT_SECRET
                        env.JWT_REFRESH_TOKEN_SECRET = JWT_REFRESH_TOKEN_SECRET
                    }
                }
            }
        }
        stage ('Set qa-stable vars') {
            when {
                environment name: 'DEPLOY_ENVIRONMENT', value: 'qa-stable'
            }
            steps {
                script {
                    withCredentials([
                        string(credentialsId: 'gtms-service-auth-qa-stable-jwt-secrect', variable: 'JWT_SECRET'),
                        string(credentialsId: 'gtms-service-auth-qa-stable-jwt-refresh-token-secrect', variable: 'JWT_REFRESH_TOKEN_SECRET')
                    ]) {
                        env.JWT_SECRET = JWT_SECRET
                        env.JWT_REFRESH_TOKEN_SECRET = JWT_REFRESH_TOKEN_SECRET
                    }
                }
            }
        }
        stage ('prepare') {
            steps {
                script {
                    try {
                        branch = env.GIT_LOCAL_BRANCH
                        branch = branch ?: env.GIT_BRANCH
                        if (branch == 'detached') {
                            branch = ''
                        }
                        branch = branch ?: env.ghprbActualCommit
                    } catch (e) {
                        println "GIT BRANCH not detected"
                    }

                    sh 'git config user.name "jenkins-kabala.tech"'
                    sh 'git config user.email "jenkins@kabala.tech"'

                    if (!branch) {
                        error "GIT branch to process not found"
                    }

                    if (branch.startsWith('origin/')) {
                        branch = branch.replaceAll('origin/', '')
                    }

                    println "GIT branch to process: ${branch}"
                    
                    manager.addShortText(branch, "white", "navy", "1px", "navy")
                    manager.addShortText("${env.SERVICE_NAME}", "white", "green", "1px", "navy")
                    manager.addShortText("${version}", "white", "navy", "1px", "navy")
                    
                    sh "printenv"
                }
            }
        }
        stage ('Checkout') {
            steps {
                    checkout([
                            $class                           : 'GitSCM',
                            branches                         : [[name: "${branch}"]],
                            browser                          : [$class: 'GithubWeb', repoUrl: "https://github.com/mariusz-kabala/gtms-backend"],
                            doGenerateSubmoduleConfigurations: false,
                            userRemoteConfigs                : [[
                                credentialsId: 'github',
                                refspec      : '+refs/pull/*:refs/remotes/origin/pr/*',
                                url          : "git@github.com:mariusz-kabala/gtms-backend.git"
                            ]]
                    ])
            }
        }
        
        stage ('Deploy worker auth') {
            when {
                environment name: 'SERVICE_NAME', value: 'worker-auth'
            }
             steps {
                dir("packages/${env.SERVICE_NAME}/terraform") {
                    script {
                        docker.withRegistry('https://docker-registry.kabala.tech', 'docker-registry-credentials') {
                            sh "terraform init"
                            sh "terraform workspace select ${env.DEPLOY_ENVIRONMENT} || terraform workspace new ${env.DEPLOY_ENVIRONMENT}"
                            sh "terraform plan -out deploy.plan -var-file=${env.DEPLOY_ENVIRONMENT}.tfvars -var=\"tag=${version}\" -var=\"DOCKER_REGISTRY_USERNAME=${DOCKER_REGISTRY_USERNAME}\" -var=\"DOCKER_REGISTRY_PASSWORD=${DOCKER_REGISTRY_PASSWORD}\"" 
                            sh "terraform apply -auto-approve deploy.plan"
                        }
                    }
                }
            }
            post {
                success {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sunny: *${env.SERVICE_NAME}* version: *${version}* Build succeeded - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
                unsuccessful {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sob: *${env.SERVICE_NAME}* version: *${version}* Build failed - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
            }
        }

        stage ('Deploy worker ES indexer') {
            when {
                environment name: 'SERVICE_NAME', value: 'worker-es-indexer'
            }
             steps {
                dir("packages/${env.SERVICE_NAME}/terraform") {
                    script {
                        docker.withRegistry('https://docker-registry.kabala.tech', 'docker-registry-credentials') {
                            sh "terraform init"
                            sh "terraform workspace select ${env.DEPLOY_ENVIRONMENT} || terraform workspace new ${env.DEPLOY_ENVIRONMENT}"
                            sh "terraform plan -out deploy.plan -var-file=${env.DEPLOY_ENVIRONMENT}.tfvars -var=\"tag=${version}\" -var=\"DOCKER_REGISTRY_USERNAME=${DOCKER_REGISTRY_USERNAME}\" -var=\"DOCKER_REGISTRY_PASSWORD=${DOCKER_REGISTRY_PASSWORD}\"" 
                            sh "terraform apply -auto-approve deploy.plan"
                        }
                    }
                }
            }
            post {
                success {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sunny: *${env.SERVICE_NAME}* version: *${version}* Build succeeded - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
                unsuccessful {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sob: *${env.SERVICE_NAME}* version: *${version}* Build failed - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
            }
        }

        stage ('Deploy worker files') {
            when {
                environment name: 'SERVICE_NAME', value: 'worker-files'
            }
             steps {
                dir("packages/${env.SERVICE_NAME}/terraform") {
                    script {
                        docker.withRegistry('https://docker-registry.kabala.tech', 'docker-registry-credentials') {
                            sh "terraform init"
                            sh "terraform workspace select ${env.DEPLOY_ENVIRONMENT} || terraform workspace new ${env.DEPLOY_ENVIRONMENT}"
                            sh "terraform plan -out deploy.plan -var-file=${env.DEPLOY_ENVIRONMENT}.tfvars -var=\"tag=${version}\" -var=\"AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}\" -var=\"AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}\" -var=\"DOCKER_REGISTRY_USERNAME=${DOCKER_REGISTRY_USERNAME}\" -var=\"DOCKER_REGISTRY_PASSWORD=${DOCKER_REGISTRY_PASSWORD}\"" 
                            sh "terraform apply -auto-approve deploy.plan"
                        }
                    }
                }
            }
            post {
                success {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sunny: *${env.SERVICE_NAME}* version: *${version}* Build succeeded - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
                unsuccessful {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sob: *${env.SERVICE_NAME}* version: *${version}* Build failed - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
            }
        }

        stage ('Deploy worker groups') {
            when {
                environment name: 'SERVICE_NAME', value: 'worker-groups'
            }
             steps {
                dir("packages/${env.SERVICE_NAME}/terraform") {
                    script {
                        docker.withRegistry('https://docker-registry.kabala.tech', 'docker-registry-credentials') {
                            sh "terraform init"
                            sh "terraform workspace select ${env.DEPLOY_ENVIRONMENT} || terraform workspace new ${env.DEPLOY_ENVIRONMENT}"
                            sh "terraform plan -out deploy.plan -var-file=${env.DEPLOY_ENVIRONMENT}.tfvars -var=\"tag=${version}\" -var=\"DOCKER_REGISTRY_USERNAME=${DOCKER_REGISTRY_USERNAME}\" -var=\"DOCKER_REGISTRY_PASSWORD=${DOCKER_REGISTRY_PASSWORD}\"" 
                            sh "terraform apply -auto-approve deploy.plan"
                        }
                    }
                }
            }
            post {
                success {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sunny: *${env.SERVICE_NAME}* version: *${version}* Build succeeded - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
                unsuccessful {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sob: *${env.SERVICE_NAME}* version: *${version}* Build failed - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
            }
        }

        stage ('Deploy worker tags') {
            when {
                environment name: 'SERVICE_NAME', value: 'worker-tags'
            }
             steps {
                dir("packages/${env.SERVICE_NAME}/terraform") {
                    script {
                        docker.withRegistry('https://docker-registry.kabala.tech', 'docker-registry-credentials') {
                            sh "terraform init"
                            sh "terraform workspace select ${env.DEPLOY_ENVIRONMENT} || terraform workspace new ${env.DEPLOY_ENVIRONMENT}"
                            sh "terraform plan -out deploy.plan -var-file=${env.DEPLOY_ENVIRONMENT}.tfvars -var=\"tag=${version}\" -var=\"DOCKER_REGISTRY_USERNAME=${DOCKER_REGISTRY_USERNAME}\" -var=\"DOCKER_REGISTRY_PASSWORD=${DOCKER_REGISTRY_PASSWORD}\"" 
                            sh "terraform apply -auto-approve deploy.plan"
                        }
                    }
                }
            }
            post {
                success {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sunny: *${env.SERVICE_NAME}* version: *${version}* Build succeeded - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
                unsuccessful {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sob: *${env.SERVICE_NAME}* version: *${version}* Build failed - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
            }
        }

        stage ('Deploy worker posts') {
            when {
                environment name: 'SERVICE_NAME', value: 'worker-posts'
            }
             steps {
                dir("packages/${env.SERVICE_NAME}/terraform") {
                    script {
                        docker.withRegistry('https://docker-registry.kabala.tech', 'docker-registry-credentials') {
                            sh "terraform init"
                            sh "terraform workspace select ${env.DEPLOY_ENVIRONMENT} || terraform workspace new ${env.DEPLOY_ENVIRONMENT}"
                            sh "terraform plan -out deploy.plan -var-file=${env.DEPLOY_ENVIRONMENT}.tfvars -var=\"tag=${version}\" -var=\"DOCKER_REGISTRY_USERNAME=${DOCKER_REGISTRY_USERNAME}\" -var=\"DOCKER_REGISTRY_PASSWORD=${DOCKER_REGISTRY_PASSWORD}\"" 
                            sh "terraform apply -auto-approve deploy.plan"
                        }
                    }
                }
            }
            post {
                success {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sunny: *${env.SERVICE_NAME}* version: *${version}* Build succeeded - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
                unsuccessful {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sob: *${env.SERVICE_NAME}* version: *${version}* Build failed - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
            }
        }

        stage ('Deploy worker notifications') {
            when {
                environment name: 'SERVICE_NAME', value: 'worker-notifications'
            }
             steps {
                dir("packages/${env.SERVICE_NAME}/terraform") {
                    script {
                        docker.withRegistry('https://docker-registry.kabala.tech', 'docker-registry-credentials') {
                            sh "terraform init"
                            sh "terraform workspace select ${env.DEPLOY_ENVIRONMENT} || terraform workspace new ${env.DEPLOY_ENVIRONMENT}"
                            sh "terraform plan -out deploy.plan -var-file=${env.DEPLOY_ENVIRONMENT}.tfvars -var=\"tag=${version}\" -var=\"DOCKER_REGISTRY_USERNAME=${DOCKER_REGISTRY_USERNAME}\" -var=\"DOCKER_REGISTRY_PASSWORD=${DOCKER_REGISTRY_PASSWORD}\" -var=\"SENDGRID_API_KEY=${SENDGRID_API_KEY}\"" 
                            sh "terraform apply -auto-approve deploy.plan"
                        }
                    }
                }
            }
            post {
                success {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sunny: *${env.SERVICE_NAME}* version: *${version}* Build succeeded - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
                unsuccessful {
                    rocketSend channel: "deployments-${env.DEPLOY_ENVIRONMENT}", message: "[${BUILD_DISPLAY_NAME}] :sob: *${env.SERVICE_NAME}* version: *${version}* Build failed - ${env.JOB_NAME} ${env.BUILD_NUMBER}  (<${env.BUILD_URL}|Open>)", rawMessage: true
                }
            }
        }
    }
}
