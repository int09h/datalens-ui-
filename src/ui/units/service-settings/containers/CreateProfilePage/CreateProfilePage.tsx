import React from 'react';

import {Flex} from '@gravity-ui/uikit';
import {unstable_Breadcrumbs as Breadcrumbs} from '@gravity-ui/uikit/unstable';
import block from 'bem-cn-lite';
import {I18n} from 'i18n';
import {useHistory} from 'react-router-dom';
import {ActionPanel} from 'ui/components/ActionPanel';
import {DL} from 'ui/constants';

import {CreateUserForm} from '../../components/CreateUserForm/CreateUserForm';
import AccessErrorPage from '../AccessErrorPage/AccessErrorPage';

import './CreateProfilePage.scss';

const b = block('create-user-page');

const i18nMain = I18n.keyset('service-settings.main.view');
const i18n = I18n.keyset('service-settings.create-user.view');

const CreateProfilePage = () => {
    const history = useHistory();

    if (!DL.IS_NATIVE_AUTH_ADMIN) {
        return <AccessErrorPage />;
    }

    return (
        <main className={b()}>
            <ActionPanel
                leftItems={
                    <Breadcrumbs navigate={(href) => history.push(href)}>
                        <Breadcrumbs.Item href="/settings">
                            {i18nMain('label_header')}
                        </Breadcrumbs.Item>
                        <Breadcrumbs.Item href="/settings/users">
                            {i18nMain('section_users')}
                        </Breadcrumbs.Item>
                        <Breadcrumbs.Item disabled={true}>
                            {i18n('title_create-user')}
                        </Breadcrumbs.Item>
                    </Breadcrumbs>
                }
            />
            <Flex className={b('content')}>
                <CreateUserForm />
            </Flex>
        </main>
    );
};

export default CreateProfilePage;
