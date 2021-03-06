def branch = '';
def changedJSON = '';
def hasNewLock = '0';

pipeline {
    agent { docker { image 'docker-registry.kabala.tech/gtms-be-builder:latest' } }

    environment {
        app = ''
        CI = 'true'
        GIT_SSH_COMMAND = "ssh -o StrictHostKeyChecking=no"
        GH_TOKEN = credentials('jenkins-github-accesstoken')
        HOME = '.'
    }

    stages {
        stage ('prepare') {
            steps {
                script {
                    try {
                        branch = env.ghprbActualCommit
                        branch = branch ?: env.GIT_BRANCH
                        if (branch == 'detached') {
                            branch = ''
                        }
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
        stage ('Install dependencies') {
            steps {
                script {
                    sh "yarn install"

                    try {
                        hasNewLock = sh (
                            script: 'git status | grep -c yarn.lock',
                            returnStdout: true,
                            returnStatus: false
                        ).trim()
                    } catch (Exception e) {
                        // ignore
                    }
                }
            }
        }
        stage ('Update lock file') {
            when {
                allOf {
                    expression {
                        hasNewLock == '1'
                    }
                    expression {
                        branch == 'master'
                    }
                }
            }
            steps {
                script {
                    sshagent(['jenkins-ssh-key']) {
                        sh "git checkout ${branch}"
                        sh "git add yarn.lock"
                        sh "git commit -m 'chore: update lock file'"
                        sh "git push origin ${branch}"
                    }
                }
            }
        }
        stage ('Look for services to build and deploy') {
            steps {
                script {
                    try {
                        def changed = sh returnStdout: true, script: "lerna changed --all --json"
                        StringBuilder services = new StringBuilder()
                        changedJSON = new groovy.json.JsonSlurperClassic().parseText(changed)
                    } catch (e) {
                        currentBuild.result = 'SUCCESS'
                    }
                }
            }
        }
        stage ('Release') {
            steps {
                script {
                    sshagent(['jenkins-ssh-key']) {
                        sh "git checkout ${branch}"
                        sh "lerna version --no-commit-hooks"
                    }
                }
            }
        }
        stage ('Build services') {
            steps {
                script {
                    changedJSON.each{
                        if (it.name.contains("@gtms/service-") || it.name.contains("@gtms/swagger") || it.name.contains("@gtms/worker-") || it.name.contains("@gtms/gatekeeper-")) {
                            build job: '(GTMS Backend) Build service', wait: false, parameters: [
                                string(name: 'ghprbActualCommit', value: "${ghprbActualCommit}"),
                                string(name: 'serviceName', value: it.location.replace("${env.WORKSPACE}/packages/", "")),
                                string(name: 'deploy', value: 'true'),
                                string(name: 'DEPLOY_ENVIRONMENT', value: 'qa-master')
                            ]
                        }
                    }
                }
            }
        }
    }
}
